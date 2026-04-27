import { describe, it, expect, vi } from 'vitest'
import { transformSync } from '@babel/core'
import type { MigrationAdapter } from '@use-transaction/migration'
import { babelPlugin } from './babel-plugin.js'

function transform(code: string): string {
  const mockAdapter: MigrationAdapter = { emit: vi.fn().mockResolvedValue(undefined) }

  const result = transformSync(code, {
    filename: 'test.ts',
    plugins: [[babelPlugin, { adapter: mockAdapter }]],
    presets: [['@babel/preset-typescript', { allExtensions: true, isTSX: false }]],
    configFile: false,
    babelrc: false,
  })

  return result?.code ?? ''
}

describe('babelPlugin — rewrite', () => {
  it('replaces useTransaction tag with _useTransactionRpc call', () => {
    const output = transform('useTransaction`SELECT 1`')
    expect(output).toContain('_useTransactionRpc(')
    expect(output).not.toContain('useTransaction`')
  })

  it('passes the function name as the first argument', () => {
    const output = transform('useTransaction`SELECT 1`')
    expect(output).toMatch(/_useTransactionRpc\(["']ut_[0-9a-f]{8}["']/)
  })

  it('passes an empty object when there are no params', () => {
    const output = transform('useTransaction`SELECT 1`')
    expect(output).toMatch(/_useTransactionRpc\(["']ut_[0-9a-f]{8}["'],\s*\{\}/)
  })

  it('passes params as shorthand object properties', () => {
    const output = transform(
      'useTransaction`SELECT * FROM t WHERE id = ${userId} AND org = ${orgId}`',
    )
    expect(output).toContain('{')
    expect(output).toContain('userId')
    expect(output).toContain('orgId')
    expect(output).toMatch(/\{\s*userId,\s*orgId\s*\}/)
  })

  it('replaces useTransactionMutation with _useTransactionMutationRpc', () => {
    const output = transform(
      'useTransactionMutation`INSERT INTO t (name) VALUES (${name}) RETURNING id`',
    )
    expect(output).toContain('_useTransactionMutationRpc(')
    expect(output).not.toContain('useTransactionMutation`')
  })

  it('preserves TypeScript generic type parameters', () => {
    const output = transform(
      'useTransaction<{ id: string }[]>`SELECT id FROM users WHERE org = ${orgId}`',
    )
    // Type params are stripped by preset-typescript, but verify the call is correct
    expect(output).toContain('_useTransactionRpc(')
    expect(output).toContain('orgId')
  })

  it('rewrites the options call form', () => {
    const output = transform(
      "useTransaction({ security: 'definer' })`SELECT 1`",
    )
    expect(output).toContain('_useTransactionRpc(')
    expect(output).not.toContain('useTransaction(')
    expect(output).not.toContain('security')
  })

  it('rewrites multiple calls in one file', () => {
    const output = transform(`
      const a = useTransaction\`SELECT 1\`
      const b = useTransactionMutation\`INSERT INTO t (x) VALUES (\${x})\`
    `)
    expect(output).toContain('_useTransactionRpc(')
    expect(output).toContain('_useTransactionMutationRpc(')
  })

  it('injects an import from @use-transaction/core', () => {
    const output = transform('useTransaction`SELECT 1`')
    expect(output).toContain('@use-transaction/core')
    expect(output).toContain('_useTransactionRpc')
  })

  it('injects both RPC imports when both hooks are used', () => {
    const output = transform(`
      const a = useTransaction\`SELECT 1\`
      const b = useTransactionMutation\`INSERT INTO t (x) VALUES (\${x})\`
    `)
    expect(output).toContain('_useTransactionRpc')
    expect(output).toContain('_useTransactionMutationRpc')
  })

  it('does not duplicate import if already present', () => {
    const output = transform(`
      import { _useTransactionRpc } from '@use-transaction/core'
      useTransaction\`SELECT 1\`
    `)
    const count = (output.match(/@use-transaction\/core/g) ?? []).length
    expect(count).toBe(1)
  })

  it('adds specifier to existing import if core is already imported', () => {
    // Use the import so the TS preset does not elide it before our plugin runs
    const output = transform(`
      import { TransactionProvider } from '@use-transaction/core'
      const _p = TransactionProvider
      useTransaction\`SELECT 1\`
    `)
    const importLine = output
      .split('\n')
      .find((l) => l.includes('@use-transaction/core'))
    expect(importLine).toContain('TransactionProvider')
    expect(importLine).toContain('_useTransactionRpc')
  })

  it('emits the SqlFunction to the adapter', async () => {
    const emit = vi.fn().mockResolvedValue(undefined)
    const adapter: MigrationAdapter = { emit }

    transformSync('useTransaction`SELECT 1`', {
      filename: 'test.ts',
      plugins: [[babelPlugin, { adapter }]],
      presets: [['@babel/preset-typescript', { allExtensions: true }]],
      configFile: false,
      babelrc: false,
    })

    expect(emit).toHaveBeenCalledOnce()
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/^ut_[0-9a-f]{8}$/),
        sql: 'SELECT 1',
        params: [],
        security: 'invoker',
      }),
    )
  })

  it('emits each unique SQL function only once across multiple identical calls', () => {
    const emit = vi.fn().mockResolvedValue(undefined)
    const adapter: MigrationAdapter = { emit }

    transformSync(
      `
      useTransaction\`SELECT 1\`
      useTransaction\`SELECT 1\`
    `,
      {
        filename: 'test.ts',
        plugins: [[babelPlugin, { adapter }]],
        presets: [['@babel/preset-typescript', { allExtensions: true }]],
        configFile: false,
        babelrc: false,
      },
    )

    expect(emit).toHaveBeenCalledOnce()
  })
})
