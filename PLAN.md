# Implementation Plan

Rough phases, ordered by dependency. Each phase should be independently shippable or testable.

---

## Phase 0 — Repo Scaffolding

- [ ] Initialize pnpm workspace with `packages/` and `apps/` directories
- [ ] Set up `packages/core`, `packages/compiler`, `packages/migration`
- [ ] TypeScript project references, shared `tsconfig.base.json`
- [ ] Linting (ESLint), formatting (Prettier), basic CI (GitHub Actions)
- [ ] Changesets for versioning

---

## Phase 1 — Core Runtime (`@use-transaction/core`)

Goal: a `useTransaction` React hook that is safe to import in frontend code and throws a clear error if the compiler transform was skipped.

`useTransaction` is a proper React hook — it returns `{ data, loading, error }` and re-fetches when interpolated values change (they become the reactive dependency array, equivalent to `useEffect` deps).

- [ ] Define `useTransaction` (SELECT) and `useTransactionMutation` (INSERT/UPDATE/DELETE RETURNING) as React hooks
- [ ] Runtime stub that throws `MissingCompilerTransformError` with a helpful message
- [ ] TypeScript generics for return type annotation: `useTransaction<Row[]>`
- [ ] Define fetcher adapter interface (pluggable — React Query, SWR, etc.)
- [ ] `<TransactionProvider adapter={...}>` at the app root — adapter configured once, consumed by all `useTransaction` hooks via context
- [ ] Ship a built-in default adapter (plain `useState` + `useEffect`) so the hook works with no provider required
- [ ] First-party adapters: `@use-transaction/adapter-react-query`, `@use-transaction/adapter-swr`
- [ ] React as a peer dependency
- [ ] Export `MigrationAdapter` and `SqlFunction` types (used by adapter authors)
- [ ] Unit tests for the stub behavior

---

## Phase 2 — SQL Extraction & Fingerprinting (`@use-transaction/compiler`)

Goal: given a source file, find all `useTransaction` calls and produce a stable function name + cleaned SQL.

- [ ] AST visitor (using `@babel/traverse` or `ts-morph`) that locates tagged template literals
- [ ] Extract static SQL string and identify interpolated expressions
- [ ] Validate interpolations at compile time — hard error on: nested template literals, string-returning function calls, spread expressions, or any expression that could produce a SQL fragment. Only allow identifiers and primitive literals.
- [ ] Generate deterministic `ut_<hash>` name from the SQL body (SHA-256, first 8 hex chars)
- [ ] Represent extracted info as `SqlFunction` objects
- [ ] Unit tests: correct extraction, stable hashing, interpolation edge cases

---

## Phase 3 — AST Rewrite (compiler, continued)

Goal: replace `useTransaction` calls in source with the appropriate RPC call.

- [ ] Decide on rewrite target format (supabase-js `rpc()` call vs. raw `fetch`)
- [ ] Implement Babel plugin that rewrites the tagged template to the RPC call
- [ ] Preserve TypeScript types through the transform (return type annotation flows through)
- [ ] Map interpolated template expressions to named RPC parameters
- [ ] Unit tests: rewritten output matches expected AST/source

---

## Phase 4 — Default Migration Adapter

Goal: emit `.sql` files for the extracted functions.

- [ ] Implement `DefaultAdapter` — writes `<outputDir>/<timestamp>_<name>.sql`
- [ ] SQL file template: `CREATE OR REPLACE FUNCTION`, parameter list, return type, body
- [ ] Idempotency: skip emit if the hash hasn't changed (compare against previously emitted files)
- [ ] `MigrationAdapter` interface finalized
- [ ] Unit tests for file output, idempotency

---

## Phase 5 — Vite Plugin

Goal: integrate the compiler into a standard Vite project build.

- [ ] Implement `vitePluginUseTransaction()` that hooks into Vite's transform pipeline
- [ ] Load `use-transaction.config.ts` and instantiate the configured adapter
- [ ] Run extraction + rewrite on each transformed file
- [ ] Collect all emitted `SqlFunction` objects and flush to adapter at build end
- [ ] Watch mode: re-run transform and re-emit on file changes
- [ ] Integration test: build a small fixture project and assert output files

---

## Phase 6 — Supabase Migration Adapter

Goal: emit migrations in the format `supabase db push` expects.

- [ ] Research Supabase migration file naming convention and SQL expectations
- [ ] Implement `SupabaseAdapter` writing to `supabase/migrations/`
- [ ] Handle Supabase's requirement that migrations be append-only (no `CREATE OR REPLACE` in older Supabase versions — may need versioned function names or `DROP + CREATE`)
- [ ] Document how to pair with `supabase db push` or `supabase gen types`
- [ ] Integration test against a local Supabase instance

---

## Phase 7 — CLI

Goal: allow non-Vite projects to run the transform as a standalone step.

- [ ] `use-transaction compile <glob>` — run extraction + rewrite on matching files, emit migrations
- [ ] `use-transaction diff` — show which SQL functions would be added/changed without writing files
- [ ] Config file resolution
- [ ] Wire into a typical `package.json` `build` script

---

## Phase 8 — Demo App

Goal: a real working example that shows the full loop.

- [ ] Scaffold a Vite + React app in `apps/demo`
- [ ] Connect to a local Supabase instance
- [ ] Write 2–3 `useTransaction` queries that exercise different patterns (simple select, join, parameterized)
- [ ] Show the before/after: developer source vs. compiled output vs. generated migration
- [ ] Include a `README` with step-by-step instructions to run the demo
- [ ] Stretch: deploy to Vercel with a hosted Supabase project

---

## Open Questions

1. ~~**Return type inference**~~ **Decided:** explicit generic annotation required (`useTransaction<Row[]>`), or untyped (`unknown`) if omitted. Type inference deferred — unclear if `supabase gen types` supports RPC return types. Add as a future research task.
2. ~~**Security model**~~ **Decided:** maximum safety. Interpolations must be simple identifiers or primitive expressions — the compiler hard-errors on anything that could construct dynamic SQL (nested template literals, function calls producing strings, spread expressions). No escape hatch.
3. ~~**Function naming collisions**~~ **Decided:** 8-char SHA-256 prefix of the SQL body only. Identical SQL in multiple files intentionally shares one DB function. File path is excluded — moving a file must not invalidate the migration.
4. ~~**DDL vs. DML**~~ **Decided:** mutations supported. Two hooks: `useTransaction` (SELECT, auto-executes, returns `{ data, loading, error }`) and `useTransactionMutation` (INSERT/UPDATE/DELETE RETURNING, imperative, returns `[mutate, { loading, error }]`). Compiler validates SQL type matches the hook used. DDL is not supported.
5. ~~**Supabase RLS**~~ **Decided:** `SECURITY INVOKER` is the default (RLS applies). Per-call override via double invocation — `useTransaction({ security: 'definer' })<Row[]>\`...\`` — hook is overloaded: called with an options object it returns a tag function, called directly as a tag it uses defaults.
6. ~~**Babel vs. SWC**~~ **Decided:** Babel for v1. More ergonomic plugin API, easier to debug, better ecosystem support for custom transforms. Revisit SWC if build performance becomes a concern.
7. ~~**Hook fetching strategy**~~ **Decided:** `useTransaction` accepts optional fetcher adapters (React Query, SWR, etc.). A minimal built-in adapter (plain `useState`/`useEffect`) is provided as the default so the hook works out of the box. Open: define the adapter interface.
8. ~~**API name**~~ **Decided:** `useTransaction` and `useTransactionMutation`.
9. ~~**Package name**~~ **Decided:** scoped packages — `@use-transaction/core`, `@use-transaction/compiler`, `@use-transaction/migration`, `@use-transaction/adapter-react-query`, `@use-transaction/adapter-swr`.

---

## Future / Deferred

- **Type inference** — investigate whether `supabase gen types` (or a custom schema introspection step) can automatically infer the return type of generated RPC functions, eliminating the need for explicit `useTransaction<Row[]>` annotations.

---

## Milestone Summary

| Milestone | Phases | Deliverable |
|-----------|--------|-------------|
| M1 — Proof of concept | 1–3 | Manual transform of a single file works |
| M2 — Local dev loop | 4–5 | Vite dev server extracts SQL and writes migrations on save |
| M3 — Supabase ready | 6 | Full round-trip with `supabase db push` |
| M4 — Polished | 7–8 | CLI + demo app, ready for external feedback |
