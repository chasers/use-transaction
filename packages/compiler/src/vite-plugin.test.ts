import { describe, it, expect, vi } from 'vitest'
import type { MigrationAdapter } from '@use-transaction/migration'
import { vitePlugin } from './vite-plugin.js'
import type { Plugin } from 'vite'

function makeAdapter(): MigrationAdapter {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

// Call the transform hook directly, binding null for `this` (we don't use Vite context).
function transform(
  plugin: Plugin,
  code: string,
  id: string,
): { code: string; map: unknown } | null {
  const hook = plugin.transform as ((code: string, id: string) => unknown) | undefined
  if (!hook) return null
  return hook.call(null as never, code, id) as { code: string; map: unknown } | null
}

describe('vitePlugin', () => {
  it('returns an object with name "use-transaction"', () => {
    const plugin = vitePlugin({ adapter: makeAdapter() })
    expect(plugin.name).toBe('use-transaction')
  })

  it('sets enforce to "pre"', () => {
    const plugin = vitePlugin({ adapter: makeAdapter() })
    expect(plugin.enforce).toBe('pre')
  })

  describe('transform filtering', () => {
    it('returns null for non-JS/TS files', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      expect(transform(plugin, 'useTransaction`SELECT 1`', 'styles.css')).toBeNull()
      expect(transform(plugin, 'useTransaction`SELECT 1`', 'query.sql')).toBeNull()
    })

    it('returns null when useTransaction is not in the code', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const code = 'const x = 1; export default x;'
      expect(transform(plugin, code, 'src/utils.ts')).toBeNull()
    })

    it('transforms .ts files', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const result = transform(plugin, 'useTransaction`SELECT 1`', 'query.ts')
      expect(result).not.toBeNull()
      expect(result?.code).toContain('_useTransactionRpc(')
    })

    it('transforms .tsx files', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const code = `
        import React from 'react'
        export function Q() { return useTransaction\`SELECT 1\` }
      `
      const result = transform(plugin, code, 'Query.tsx')
      expect(result).not.toBeNull()
      expect(result?.code).toContain('_useTransactionRpc(')
    })

    it('transforms .js files', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const result = transform(plugin, 'useTransaction`SELECT 1`', 'query.js')
      expect(result).not.toBeNull()
      expect(result?.code).toContain('_useTransactionRpc(')
    })
  })

  describe('code transformation', () => {
    it('rewrites useTransaction to _useTransactionRpc', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const result = transform(plugin, 'useTransaction`SELECT 1`', 'q.ts')
      expect(result?.code).toContain('_useTransactionRpc(')
      expect(result?.code).not.toContain('useTransaction`')
    })

    it('rewrites useTransactionMutation to _useTransactionMutationRpc', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const result = transform(
        plugin,
        'useTransactionMutation`INSERT INTO t (x) VALUES (${x})`',
        'q.ts',
      )
      expect(result?.code).toContain('_useTransactionMutationRpc(')
    })

    it('injects the import from @use-transaction/core', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const result = transform(plugin, 'useTransaction`SELECT 1`', 'q.ts')
      expect(result?.code).toContain('@use-transaction/core')
    })

    it('preserves TypeScript syntax (syntax-only mode)', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const code = `
        const orgId: string = 'x'
        useTransaction\`SELECT * FROM t WHERE id = \${orgId}\`
      `
      const result = transform(plugin, code, 'q.ts')
      // Type annotation should still be present — we're only rewriting, not stripping TS
      expect(result?.code).toContain(': string')
    })

    it('includes a source map', () => {
      const plugin = vitePlugin({ adapter: makeAdapter() })
      const result = transform(plugin, 'useTransaction`SELECT 1`', 'q.ts')
      expect(result?.map).toBeTruthy()
    })
  })

  describe('adapter integration', () => {
    it('calls adapter.emit for each unique query', () => {
      const adapter = makeAdapter()
      const plugin = vitePlugin({ adapter })
      transform(plugin, 'useTransaction`SELECT 1`', 'q.ts')
      expect(adapter.emit).toHaveBeenCalledOnce()
    })

    it('passes the SqlFunction to the adapter', () => {
      const adapter = makeAdapter()
      const plugin = vitePlugin({ adapter })
      transform(plugin, 'useTransaction`SELECT * FROM users WHERE id = ${userId}`', 'q.ts')
      expect(adapter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^ut_[0-9a-f]{8}$/),
          sql: 'SELECT * FROM users WHERE id = userId',
          params: [{ name: 'userId', index: 0 }],
          security: 'invoker',
          type: 'query',
        }),
      )
    })

    it('does not call adapter.emit for files without useTransaction', () => {
      const adapter = makeAdapter()
      const plugin = vitePlugin({ adapter })
      transform(plugin, 'const x = 1', 'q.ts')
      expect(adapter.emit).not.toHaveBeenCalled()
    })
  })
})
