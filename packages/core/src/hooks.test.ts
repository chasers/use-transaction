import { describe, it, expect } from 'vitest'
import { useTransaction, useTransactionMutation } from './hooks.js'

const ERROR_PATTERN = /@use-transaction\/core/

describe('useTransaction', () => {
  it('throws when called directly as a tag', () => {
    expect(() => useTransaction`SELECT 1`).toThrow(ERROR_PATTERN)
  })

  it('throws when called with options then used as a tag', () => {
    const tag = useTransaction({ security: 'definer' })
    expect(() => tag`SELECT 1`).toThrow(ERROR_PATTERN)
  })

  it('throws when called with empty options then used as a tag', () => {
    const tag = useTransaction({})
    expect(() => tag`SELECT 1`).toThrow(ERROR_PATTERN)
  })
})

describe('useTransactionMutation', () => {
  it('throws when called directly as a tag', () => {
    expect(() => useTransactionMutation`INSERT INTO t (x) VALUES (${1})`).toThrow(
      ERROR_PATTERN,
    )
  })

  it('throws when called with options then used as a tag', () => {
    const tag = useTransactionMutation({ security: 'definer' })
    expect(() => tag`INSERT INTO t (x) VALUES (${1})`).toThrow(ERROR_PATTERN)
  })
})
