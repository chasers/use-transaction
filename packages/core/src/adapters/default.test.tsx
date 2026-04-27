import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { defaultAdapter } from './default.js'
import { TransactionProvider } from '../provider.js'
import { _useTransactionRpc, _useTransactionMutationRpc } from '../hooks.js'
import type { RpcClient } from '../types.js'

function makeClient(data: unknown = [], error: null | { message: string } = null): RpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  }
}

function wrapper(client: RpcClient) {
  const adapter = defaultAdapter(client)
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <TransactionProvider adapter={adapter}>{children}</TransactionProvider>
  }
}

describe('defaultAdapter — useQuery', () => {
  it('returns loading:true initially then data on success', async () => {
    const client = makeClient([{ id: '1' }])
    const { result } = renderHook(
      () => _useTransactionRpc<{ id: string }[]>('ut_test', {}),
      { wrapper: wrapper(client) },
    )

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual([{ id: '1' }])
    expect(result.current.error).toBeUndefined()
  })

  it('sets error when rpc returns an error', async () => {
    const client = makeClient(null, { message: 'permission denied' })
    const { result } = renderHook(
      () => _useTransactionRpc('ut_test', {}),
      { wrapper: wrapper(client) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toBe('permission denied')
    expect(result.current.data).toBeUndefined()
  })

  it('re-fetches when params change', async () => {
    const client = makeClient([{ id: '1' }])
    let cutoff = '2026-01-01'
    const { result, rerender } = renderHook(
      () => _useTransactionRpc('ut_test', { cutoff }),
      { wrapper: wrapper(client) },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(client.rpc).toHaveBeenCalledTimes(1)

    cutoff = '2026-06-01'
    rerender()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(client.rpc).toHaveBeenCalledTimes(2)
    expect(client.rpc).toHaveBeenLastCalledWith('ut_test', { cutoff: '2026-06-01' })
  })
})

describe('defaultAdapter — useMutation', () => {
  it('returns a mutate function and initial state', () => {
    const client = makeClient({ id: '1' })
    const { result } = renderHook(
      () => _useTransactionMutationRpc('ut_test', {}),
      { wrapper: wrapper(client) },
    )

    const [mutate, { loading, error }] = result.current
    expect(typeof mutate).toBe('function')
    expect(loading).toBe(false)
    expect(error).toBeUndefined()
  })

  it('calls rpc with latest params when mutate is invoked', async () => {
    const client = makeClient({ id: '42' })
    let name = 'Alice'
    const { result, rerender } = renderHook(
      () => _useTransactionMutationRpc('ut_test', { name }),
      { wrapper: wrapper(client) },
    )

    name = 'Bob'
    rerender()

    const [mutate] = result.current
    await act(() => mutate())

    expect(client.rpc).toHaveBeenCalledWith('ut_test', { name: 'Bob' })
  })

  it('sets loading during mutation and clears it after', async () => {
    const client = makeClient({ id: '1' })
    const { result } = renderHook(
      () => _useTransactionMutationRpc('ut_test', {}),
      { wrapper: wrapper(client) },
    )

    const [mutate] = result.current
    const promise = act(() => mutate())
    await promise
    expect(result.current[1].loading).toBe(false)
  })

  it('sets error when rpc returns an error', async () => {
    const client = makeClient(null, { message: 'insert failed' })
    const { result } = renderHook(
      () => _useTransactionMutationRpc('ut_test', {}),
      { wrapper: wrapper(client) },
    )

    const [mutate] = result.current
    await act(() => mutate())
    expect(result.current[1].error?.message).toBe('insert failed')
  })
})
