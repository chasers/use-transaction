import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import React from 'react'
import { TransactionProvider, useTransactionContext } from './provider.js'
import type { FetcherAdapter } from './types.js'

const mockAdapter: FetcherAdapter = {
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}

describe('useTransactionContext', () => {
  it('throws when called outside TransactionProvider', () => {
    expect(() => renderHook(() => useTransactionContext())).toThrow(
      /@use-transaction\/core/,
    )
  })

  it('returns the adapter provided to TransactionProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TransactionProvider adapter={mockAdapter}>{children}</TransactionProvider>
    )
    const { result } = renderHook(() => useTransactionContext(), { wrapper })
    expect(result.current.adapter).toBe(mockAdapter)
  })
})
