# Agent Guidelines

Instructions for AI agents (Claude Code, etc.) working in this repository.

## Project in One Sentence

`use-transaction` is a TypeScript library + build tool: developers write SQL in frontend code via a tagged template literal; a build step strips the SQL, rewrites calls to PostgREST RPC, and emits migration files.

## Key Files to Read First

- `README.md` — user-facing overview and the before/after example
- `PLAN.md` — phased roadmap and open questions
- `DEVELOPMENT.md` — package responsibilities, adapter interface, repo structure
- `MEMORY.md` — corrections, decisions, and learnings from prior sessions (read this before starting work)

## Conventions

- TypeScript strict mode throughout; no `any` unless unavoidable and commented
- `packages/core` must have zero runtime dependencies — it ships to the client
- Compiler and migration packages are Node.js-only; they may use any dev dependency freely
- pnpm workspaces; do not use npm or yarn
- No comments that describe what code does — only comments explaining non-obvious *why*

## Before Writing Code

1. Check `MEMORY.md` for prior corrections relevant to your task
2. Check `PLAN.md` to understand which phase the task falls in and what's already decided
3. Prefer editing existing files over creating new ones
4. Do not implement features beyond the scope of the current task

## Migration Adapter Interface

The central contract of this library. Any change to `MigrationAdapter` or `SqlFunction` types in `packages/core` is a breaking change — flag it explicitly.

## Security Invariant

Interpolated expressions in `useTransaction` template literals must **always** become named RPC parameters — never string-concatenated into SQL. This is the core security guarantee. Do not break this under any circumstances.

## Open Questions (Do Not Resolve Unilaterally)

See the "Open Questions" section in `PLAN.md`. These require a decision from the project owner before implementation. If your task touches one, surface it rather than picking an answer.
