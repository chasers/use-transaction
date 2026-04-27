import { describe, it, expect } from 'vitest'
import { extractFromSource, extractTaggedTemplate } from './extractor.js'
import { CompilerError } from './errors.js'
import type { ExtractedCall } from './extractor.js'

function extractOne(code: string): ExtractedCall {
  const results = extractFromSource(code, 'test.ts')
  if (results.length !== 1) throw new Error(`Expected 1 result, got ${results.length}`)
  return results[0]!
}

describe('extractFromSource', () => {
  it('ignores non-hook tagged templates', () => {
    expect(extractFromSource('const x = html`<div />`')).toHaveLength(0)
    expect(extractFromSource('const x = css`color: red`')).toHaveLength(0)
  })

  it('extracts a simple useTransaction with no params', () => {
    const result = extractOne('useTransaction`SELECT 1`')
    expect(result.hookName).toBe('useTransaction')
    expect(result.sqlFunction.params).toHaveLength(0)
    expect(result.sqlFunction.sql).toBe('SELECT 1')
    expect(result.sqlFunction.security).toBe('invoker')
    expect(result.sqlFunction.name).toMatch(/^ut_[0-9a-f]{8}$/)
  })

  it('extracts a useTransaction with identifier params', () => {
    const result = extractOne(
      'useTransaction`SELECT * FROM users WHERE id = ${userId} AND org = ${orgId}`',
    )
    expect(result.sqlFunction.params).toEqual([
      { name: 'userId', index: 0 },
      { name: 'orgId', index: 1 },
    ])
    expect(result.sqlFunction.sql).toBe(
      'SELECT * FROM users WHERE id = userId AND org = orgId',
    )
  })

  it('extracts useTransactionMutation', () => {
    const result = extractOne(
      'useTransactionMutation`INSERT INTO users (name) VALUES (${name}) RETURNING id`',
    )
    expect(result.hookName).toBe('useTransactionMutation')
    expect(result.sqlFunction.params).toEqual([{ name: 'name', index: 0 }])
  })

  it('defaults security to invoker', () => {
    expect(extractOne('useTransaction`SELECT 1`').sqlFunction.security).toBe('invoker')
  })

  it('reads security: definer from options', () => {
    const result = extractOne("useTransaction({ security: 'definer' })`SELECT 1`")
    expect(result.sqlFunction.security).toBe('definer')
  })

  it('reads security: invoker from options explicitly', () => {
    const result = extractOne("useTransaction({ security: 'invoker' })`SELECT 1`")
    expect(result.sqlFunction.security).toBe('invoker')
  })

  it('extracts multiple calls from one file', () => {
    const results = extractFromSource(`
      useTransaction\`SELECT 1\`
      useTransaction\`SELECT 2\`
      useTransactionMutation\`INSERT INTO t (x) VALUES (\${x})\`
    `)
    expect(results).toHaveLength(3)
  })

  describe('hash stability', () => {
    it('produces the same hash regardless of param variable names', () => {
      const a = extractOne('useTransaction`SELECT * FROM t WHERE id = ${userId}`')
      const b = extractOne('useTransaction`SELECT * FROM t WHERE id = ${id}`')
      expect(a.sqlFunction.hash).toBe(b.sqlFunction.hash)
      expect(a.sqlFunction.name).toBe(b.sqlFunction.name)
    })

    it('produces different hashes for different SQL structures', () => {
      const a = extractOne('useTransaction`SELECT 1`')
      const b = extractOne('useTransaction`SELECT 2`')
      expect(a.sqlFunction.hash).not.toBe(b.sqlFunction.hash)
    })

    it('produces the same hash for whitespace variations', () => {
      const a = extractOne('useTransaction`SELECT  *  FROM  t`')
      const b = extractOne('useTransaction`SELECT * FROM t`')
      expect(a.sqlFunction.hash).toBe(b.sqlFunction.hash)
    })

    it('identical SQL in different hooks shares the same hash', () => {
      const a = extractOne('useTransaction`SELECT 1`')
      const b = extractOne('useTransactionMutation`SELECT 1`')
      expect(a.sqlFunction.hash).toBe(b.sqlFunction.hash)
    })
  })

  describe('interpolation validation', () => {
    it('throws CompilerError for function call interpolations', () => {
      expect(() => extractFromSource('useTransaction`SELECT ${someFunc()}`', 'test.ts')).toThrow(
        CompilerError,
      )
    })

    it('throws CompilerError for ternary expressions', () => {
      expect(() =>
        extractFromSource('useTransaction`SELECT ${a ? b : c}`', 'test.ts'),
      ).toThrow(CompilerError)
    })

    it('throws CompilerError for binary expressions', () => {
      expect(() =>
        extractFromSource('useTransaction`SELECT ${a + b}`', 'test.ts'),
      ).toThrow(CompilerError)
    })

    it('includes the filename in the error message', () => {
      try {
        extractFromSource('useTransaction`SELECT ${someFunc()}`', 'src/queries.ts')
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(CompilerError)
        expect((e as CompilerError).message).toContain('src/queries.ts')
      }
    })

    it('includes a hint about assigning to a variable', () => {
      try {
        extractFromSource('useTransaction`SELECT ${someFunc()}`', 'test.ts')
        expect.fail('should have thrown')
      } catch (e) {
        expect((e as CompilerError).message).toContain('variable')
      }
    })
  })
})
