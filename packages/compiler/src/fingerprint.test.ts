import { describe, it, expect } from 'vitest'
import { normalizeSQL, fingerprintSQL, toFunctionName } from './fingerprint.js'

describe('normalizeSQL', () => {
  it('collapses whitespace', () => {
    expect(normalizeSQL('SELECT  *\n  FROM  t')).toBe('SELECT * FROM t')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeSQL('  SELECT 1  ')).toBe('SELECT 1')
  })
})

describe('fingerprintSQL', () => {
  it('returns an 8-character hex string', () => {
    const hash = fingerprintSQL('SELECT 1')
    expect(hash).toHaveLength(8)
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is stable — same SQL always produces the same hash', () => {
    expect(fingerprintSQL('SELECT 1')).toBe(fingerprintSQL('SELECT 1'))
  })

  it('is stable across whitespace variants', () => {
    expect(fingerprintSQL('SELECT  1')).toBe(fingerprintSQL('SELECT 1'))
    expect(fingerprintSQL('  SELECT 1  ')).toBe(fingerprintSQL('SELECT 1'))
  })

  it('produces different hashes for different SQL', () => {
    expect(fingerprintSQL('SELECT 1')).not.toBe(fingerprintSQL('SELECT 2'))
  })

  it('produces different hashes for different param positions', () => {
    const a = fingerprintSQL('SELECT * FROM t WHERE a = $1 AND b = $2')
    const b = fingerprintSQL('SELECT * FROM t WHERE b = $1 AND a = $2')
    expect(a).not.toBe(b)
  })
})

describe('toFunctionName', () => {
  it('prefixes hash with ut_', () => {
    expect(toFunctionName('abc12345')).toBe('ut_abc12345')
  })
})
