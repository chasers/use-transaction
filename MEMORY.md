# Memory

A living record of corrections, decisions, and non-obvious learnings from working sessions. Agents must read this before starting any task.

Each entry has a date, a category, and enough context to apply the lesson to future work.

---

<!-- Add entries below in reverse-chronological order (newest first). -->
<!-- Format:
## YYYY-MM-DD — Category: Short Title
Body: the rule or decision, plus *why* and *when to apply it*.
-->

## 2026-04-27 — Decision: fetcher adapter pattern

`useTransaction` accepts an optional fetcher adapter (React Query, SWR, etc.) rather than being opinionated about caching/deduplication. A built-in default adapter (plain `useState`/`useEffect`) ships so it works with zero extra dependencies. First-party adapters live in separate packages (`@use-transaction/adapter-react-query`, etc.).

**Why:** Developers already have strong opinions about data fetching libraries; forcing one would be a dealbreaker.

**How to apply:** The adapter interface must be defined in `core`. Adapter is configured once via `<TransactionProvider adapter={...}>` at the app root — not per hook call. The hook reads it from context. Do not add an `adapter` prop to individual `useTransaction` calls. Do not bake React Query or SWR as a hard dependency anywhere. `TransactionProvider` does not accept a Supabase client — the adapter factory does (e.g. `reactQueryAdapter(supabase)`), since projects already have their client configured as a singleton.

---

## 2026-04-27 — Decision: scoped npm packages

All packages are scoped under `@use-transaction/*`: `core`, `compiler`, `migration`, `adapter-react-query`, `adapter-swr`.

**Why:** Hard split between browser runtime (`core`) and build-time tooling (`compiler`, `migration`) — scoping keeps heavy dependencies out of the client bundle.

**How to apply:** Never add Node.js-only or heavy dependencies to `@use-transaction/core`.

---

## 2026-04-27 — Decision: Babel for AST transforms

Babel chosen over SWC for v1. More ergonomic plugin API, easier to debug. Revisit if build performance becomes a concern.

**How to apply:** All compiler AST work uses `@babel/traverse` and `@babel/types`. Do not introduce SWC dependencies.

---

## 2026-04-27 — Decision: SECURITY INVOKER default, per-call override allowed

Generated Postgres functions default to `SECURITY INVOKER` (RLS applies). Developers can override to `SECURITY DEFINER` per call. The exact API for the override is TBD — the tagged template literal signature makes option-passing non-trivial.

**Why:** INVOKER is the safe default; DEFINER bypasses RLS which should be explicit and intentional.

**How to apply:** Never emit `SECURITY DEFINER` unless the developer has explicitly opted in at the call site. The per-call override uses double invocation: `useTransaction({ security: 'definer' })\`...\``. The hook is overloaded — called with an options object it returns a tag function, called directly as a tag it uses defaults. Same pattern applies to `useTransactionMutation`.

---

## 2026-04-27 — Decision: mutations are supported

`INSERT`/`UPDATE`/`DELETE RETURNING` are in scope. DDL (schema changes) is not — those belong in hand-authored migrations.

**How to apply:** Two hooks — `useTransaction` for SELECT (auto-executes, `{ data, loading, error }`), `useTransactionMutation` for INSERT/UPDATE/DELETE RETURNING (imperative, `[mutate, { loading, error }]`). The compiler validates the SQL type matches the hook. The generated Postgres function wraps the mutation. The security invariant (parameterized inputs only) still applies.

---

## 2026-04-27 — Decision: function naming — 8-char SQL body hash

Function names are `ut_<hash>` where hash is the first 8 chars of SHA-256 of the SQL body only. File path is excluded. Identical SQL across files intentionally shares one DB function.

**Why:** 8 chars makes collision probability negligible. Excluding file path means moving a file doesn't generate a new migration or orphan the old function.

**How to apply:** Never include file path, line number, or any other source location in the hash input.

---

## 2026-04-27 — Decision: strict interpolation validation, no escape hatches

The compiler hard-errors on any interpolation that could construct dynamic SQL: nested template literals, string-returning function calls, spread expressions. Only identifiers and primitive literals are allowed.

**Why:** Maximum safety from the start — the structural guarantee of parameterization is not enough if someone can sneak in a SQL fragment via a function call.

**How to apply:** No `dangerouslyInjectSQL` or escape hatch. If a use case genuinely requires dynamic SQL, the answer is to write a hand-authored migration instead.

---

## 2026-04-27 — Decision: return types are explicit, inference deferred

`useTransaction<Row[]>` requires an explicit generic annotation. If omitted, the return type is `unknown`. Type inference is deferred — it's unclear whether `supabase gen types` supports RPC return types.

**Why:** Keeping it simple for v1; inference needs research before committing to an approach.

**How to apply:** Do not build any type inference logic. The compiler does not attempt to map SQL columns to TypeScript types.

---

## 2026-04-27 — Decision: `useTransaction` is a React hook

`useTransaction` must be a proper React hook returning `{ data, loading, error }`. Interpolated template values become reactive dependencies and trigger re-fetches when they change (analogous to `useEffect` deps).

**Why:** The `use` prefix is intentional — this is a first-class React hook, not a plain async utility.

**How to apply:** The runtime stub in `core` must be hook-shaped. The compiler rewrite target must produce a hook call. React is a peer dependency of `core`. Do not design a non-hook API path.
