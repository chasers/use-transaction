# Development Guide

## Repo Structure (planned)

```
use-transaction/
├── packages/
│   ├── core/           # Runtime shim + types (tiny — ships to client)
│   ├── compiler/       # Build-time transform (Babel/SWC/Vite plugin)
│   └── migration/      # Migration adapters
│       ├── default/    # Writes .sql files to a configurable folder
│       └── supabase/   # Supabase-compatible migration format
├── apps/
│   └── demo/           # Reference app (Vite + React + Supabase)
└── docs/
```

## Prerequisites

- Node.js >= 20
- pnpm (workspace manager)
- A local Supabase instance or Supabase project for running the demo

## Getting Started

```bash
pnpm install
pnpm build        # builds all packages
pnpm test         # runs all tests
```

## Package Overview

### `@use-transaction/core`

The only package that ships to the client. Exports:

- `useTransaction` — a tagged template literal that at runtime is a thin pass-through to the already-generated RPC call. Before the build transform runs it throws a helpful error ("you forgot to run the compiler").
- TypeScript types for return shapes and parameter binding.

### `@use-transaction/compiler`

Runs at build time. Responsibilities:

1. **Parse** — find all `useTransaction` tagged template literals in source files using an AST visitor.
2. **Extract** — pull out the SQL string and interpolated parameters.
3. **Fingerprint** — hash the SQL to produce a stable, deterministic function name (`ut_<hash>`).
4. **Rewrite** — replace the `useTransaction` call with the appropriate PostgREST RPC call.
5. **Emit** — hand the SQL + metadata to the active migration adapter.

Provided as:
- A Babel plugin
- A Vite/Rollup plugin
- A standalone CLI for non-bundler workflows

### `@use-transaction/migration`

An adapter interface plus built-in implementations.

**Adapter interface:**
```ts
interface MigrationAdapter {
  emit(fn: SqlFunction): Promise<void>
}

interface SqlFunction {
  name: string        // e.g. "ut_a3f9c2"
  sql: string         // the raw SQL body
  params: Param[]     // extracted interpolations
  returnType?: string // optional explicit annotation
  hash: string
}
```

**`DefaultAdapter`** — writes `<outputDir>/<timestamp>_<name>.sql` files.

**`SupabaseAdapter`** — writes into `supabase/migrations/` using Supabase's naming convention, suitable for `supabase db push`.

## Configuration

`use-transaction` is configured via `use-transaction.config.ts` (or `.js`, `.json`) at the project root:

```ts
import { defineConfig } from 'use-transaction'
import { SupabaseAdapter } from '@use-transaction/migration/supabase'

export default defineConfig({
  adapter: new SupabaseAdapter({
    migrationsDir: './supabase/migrations',
  }),
})
```

## Adding a Migration Adapter

Implement the `MigrationAdapter` interface and publish it as a separate package or inline it in your config:

```ts
class MyAdapter implements MigrationAdapter {
  async emit(fn: SqlFunction) {
    // write to wherever you want
  }
}
```

## Testing

- **Unit tests** — AST transform correctness, fingerprinting, SQL extraction
- **Integration tests** — full compile → migration → RPC round-trip against a real PostgREST instance
- **Demo app** — manual smoke test of the end-to-end workflow

## Coding Conventions

- TypeScript strict mode throughout
- No runtime dependencies in `core` (keep the client bundle tiny)
- Compiler and migration packages may use Node.js APIs freely
- Errors should be actionable — tell the developer exactly what file/line and what to fix
