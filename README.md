# use-transaction

A TypeScript library that lets you write raw SQL in frontend code and automatically compiles it to safe, type-safe PostgREST RPC calls.

## The Problem

When building apps on top of PostgREST (e.g., Supabase), you're constantly bouncing between:

1. Writing a SQL function in a migration file
2. Wiring up a PostgREST RPC call in your frontend
3. Keeping the two in sync as requirements evolve

This creates friction, duplication, and a wide surface area for type drift.

## The Solution

`use-transaction` lets you write SQL directly in your frontend code during development. A build step then:

1. **Strips** the SQL out of your application bundle
2. **Generates** a PostgREST RPC call in its place
3. **Creates** a migration file with the corresponding SQL function

Your frontend ships with zero raw SQL. Your database has the function. They're always in sync because they were defined in one place.

## Example

```tsx
// App root — configure once
import { TransactionProvider } from 'use-transaction'
import { reactQueryAdapter } from '@use-transaction/adapter-react-query'
import { supabase } from './supabase' // your existing client

export function App() {
  return (
    <TransactionProvider adapter={reactQueryAdapter(supabase)}>
      <UserList cutoff="2026-01-01" />
    </TransactionProvider>
  )
}

// Query — auto-executes, re-runs when deps change
import { useTransaction } from 'use-transaction'

function UserList({ cutoff }: { cutoff: string }) {
  const { data, loading, error } = useTransaction<{ id: string; name: string }[]>`
    SELECT id, name FROM users WHERE created_at > ${cutoff}
  `
  // ...
}

// Mutation — triggered imperatively
import { useTransactionMutation } from '@use-transaction/core'

function CreateUser() {
  const [createUser, { loading, error }] = useTransactionMutation<{ id: string }>`
    INSERT INTO users (name) VALUES (${name}) RETURNING id
  `
  // ...
}

// Override RLS per call (defaults to SECURITY INVOKER)
const { data } = useTransaction({ security: 'definer' })<Row[]>`
  SELECT * FROM restricted_view
`
```

```tsx
// After build — SQL is gone, RPC call is in its place
function UserList({ cutoff }: { cutoff: string }) {
  const { data, loading, error } = useRpc<{ id: string; name: string }[]>('ut_a3f9c2', { cutoff })
  // ...
}
```

And in your migrations folder:

```sql
-- migrations/20260427_ut_a3f9c2.sql
CREATE OR REPLACE FUNCTION ut_a3f9c2(cutoff timestamptz)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE
AS $$
  SELECT id, name FROM users WHERE created_at > cutoff
$$;
```

## Key Design Goals

- **Zero runtime SQL** — no SQL ever reaches the client bundle
- **Pluggable migration output** — default writes to a local folder; adapters for Supabase, custom systems, etc.
- **Type-safe** — parameters and return types are inferred or explicitly annotated
- **Incremental adoption** — works alongside existing RPC calls and query patterns
- **Demo app included** — a small reference app shows the full workflow end-to-end

## Status

Early design / pre-alpha. See [PLAN.md](./PLAN.md) for the roadmap.
