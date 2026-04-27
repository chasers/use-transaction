# Implementation Plan

Rough phases, ordered by dependency. Each phase should be independently shippable or testable.

---

## Phase 0 — Repo Scaffolding ✅

- [x] Initialize pnpm workspace with `packages/` and `apps/` directories
- [x] Set up `packages/core`, `packages/compiler`, `packages/migration`
- [x] TypeScript project references, shared `tsconfig.base.json`
- [ ] Linting (ESLint), formatting (Prettier), basic CI (GitHub Actions)
- [ ] Changesets for versioning

---

## Phase 1 — Core Runtime (`@use-transaction/core`) ✅

Goal: a `useTransaction` React hook that is safe to import in frontend code and throws a clear error if the compiler transform was skipped.

`useTransaction` is a proper React hook — it returns `{ data, loading, error }` and re-fetches when interpolated values change (they become the reactive dependency array, equivalent to `useEffect` deps).

- [x] Define `useTransaction` (SELECT) and `useTransactionMutation` (INSERT/UPDATE/DELETE RETURNING) as React hooks
- [x] Runtime stub that throws `MissingCompilerTransformError` with a helpful message
- [x] TypeScript generics for return type annotation: `useTransaction<Row[]>`
- [x] Define fetcher adapter interface (pluggable — React Query, SWR, etc.)
- [x] `<TransactionProvider adapter={...}>` at the app root — adapter configured once, consumed by all `useTransaction` hooks via context
- [x] Ship a built-in default adapter (plain `useState` + `useEffect`) so the hook works with no provider required
- [ ] First-party adapters: `@use-transaction/adapter-react-query`, `@use-transaction/adapter-swr`
- [x] React as a peer dependency
- [x] Export `MigrationAdapter` and `SqlFunction` types (used by adapter authors)
- [x] Unit tests for the stub behavior

---

## Phase 2 — SQL Extraction & Fingerprinting (`@use-transaction/compiler`) ✅

Goal: given a source file, find all `useTransaction` calls and produce a stable function name + cleaned SQL.

- [x] AST visitor (using `@babel/traverse`) that locates tagged template literals
- [x] Extract static SQL string and identify interpolated expressions
- [x] Validate interpolations at compile time — hard error on: nested template literals, string-returning function calls, spread expressions, or any expression that could produce a SQL fragment. Only allow identifiers and primitive literals.
- [x] Generate deterministic `ut_<hash>` name from the SQL body (SHA-256, first 8 hex chars)
- [x] Optional `label` option for human-readable names: `ut_list_users_by_org_<hash>`
- [x] Source tracing: `source: { file, line }` on every `SqlFunction` for `-- source:` comments in migrations
- [x] Represent extracted info as `SqlFunction` objects
- [x] Unit tests: correct extraction, stable hashing, interpolation edge cases

---

## Phase 3 — AST Rewrite (compiler, continued) ✅

Goal: replace `useTransaction` calls in source with the appropriate RPC call.

- [x] Rewrite target: `_useTransactionRpc(name, params)` / `_useTransactionMutationRpc(name, params)` — calls the adapter via context, not supabase-js directly
- [x] Implement Babel plugin that rewrites the tagged template to the RPC call
- [x] Preserve TypeScript generic type parameters through the transform
- [x] Map interpolated template expressions to named RPC parameters (shorthand object)
- [x] Auto-inject `import { _useTransactionRpc } from '@use-transaction/core'` — merges with existing import if present
- [x] Unit tests: rewritten output matches expected AST/source

---

## Phase 4 — Default Migration Adapter ✅

Goal: emit `.sql` files for the extracted functions.

- [x] Implement `DefaultAdapter` — writes `<outputDir>/<timestamp>_<name>.sql`
- [x] SQL file template: `CREATE OR REPLACE FUNCTION`, parameter list, `RETURNS SETOF json`, `SECURITY INVOKER/DEFINER`, `STABLE` for queries
- [x] Idempotency: skip emit if hash already present in any existing `.sql` file (works across adapter instances)
- [x] `MigrationAdapter` interface finalized
- [x] Unit tests for file output, idempotency, source comment, security modes

---

## Phase 5 — Vite Plugin ✅

Goal: integrate the compiler into a standard Vite project build.

- [x] `vitePlugin(options)` with `enforce: 'pre'` hooks into Vite's transform pipeline
- [x] Fast two-stage filter: extension check then content check — files without `useTransaction` skip immediately
- [x] Uses `@babel/plugin-syntax-typescript` (syntax-only) so Vite's esbuild still handles TS stripping
- [x] Migrations emitted on first transform of each file; idempotency handled by `DefaultAdapter`
- [ ] Config file loading (`use-transaction.config.ts`) — adapter is currently passed directly
- [ ] Watch mode: explicit re-emit on HMR file change
- [x] Tests: transform filtering, TS preservation, source maps, adapter integration

---

## Phase 6 — Supabase Migration Adapter

Goal: emit migrations in the format `supabase db push` expects, with programmatic application support.

**Note:** `DefaultAdapter` already works for the standard `supabase/migrations` file-based workflow — the Supabase CLI picks up any `.sql` files in that directory. This phase is for richer Supabase-specific integration.

- [ ] Research whether `CREATE OR REPLACE FUNCTION` is safe across all Supabase versions
- [ ] Implement `SupabaseAdapter` that applies migrations via the Supabase Management API (for CI/CD without the CLI)
- [ ] Resolve team migration conflict open question: two devs generating different timestamps for the same hash
- [ ] Document how to pair with `supabase db push` or `supabase gen types`
- [ ] Integration test against a local Supabase instance

---

## Phase 7 — CLI ✅

Goal: allow non-Vite projects to run the transform as a standalone step.

- [x] `use-transaction compile [pattern]` — scan source files, extract SQL, emit migrations via `DefaultAdapter`
- [x] `use-transaction check [pattern]` — verify all queries have been compiled; exits 1 if any migration is missing (CI gate)
- [x] `--output <dir>` flag on both commands (default: `supabase/migrations`)
- [x] Collects and reports `CompilerError`s without aborting the whole run
- [ ] `use-transaction diff` — show which functions would be added/changed without writing files
- [ ] Config file resolution (`use-transaction.config.ts`)

---

## Phase 8 — Demo App ✅ (mock) / 🔲 (real Supabase)

Goal: a real working example that shows the full loop.

- [x] Scaffold a Vite + React app in `apps/demo`
- [x] Todo list using `useTransaction` (SELECT) and `useTransactionMutation` (INSERT, UPDATE)
- [x] Mock `RpcClient` so demo runs without a real database
- [x] Vite plugin wired up — 3 migration files emitted on first `pnpm dev`
- [x] Shows transformed output: `useTransaction\`...\`` → `_useTransactionRpc("ut_60791ffb", {})`
- [ ] Connect to a real local Supabase instance (swap `mockClient` for `createClient(...)`)
- [ ] `README` with step-by-step instructions to run with Supabase
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

| Milestone | Phases | Status | Deliverable |
|-----------|--------|--------|-------------|
| M1 — Proof of concept | 1–3 | ✅ Done | Manual transform of a single file works |
| M2 — Local dev loop | 4–5 | ✅ Done | Vite dev server extracts SQL and writes migrations on save |
| M3 — Supabase ready | 6 | 🔲 Next | Full round-trip with `supabase db push` |
| M4 — Polished | 7–8 | ✅ Done (partial) | CLI + demo app, ready for external feedback |
