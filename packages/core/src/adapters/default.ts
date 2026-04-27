import { useState, useEffect, useRef, useCallback } from 'react'
import type { FetcherAdapter, QueryResult, MutationTuple, RpcClient } from '../types.js'

export function defaultAdapter(client: RpcClient): FetcherAdapter {
  return {
    useQuery<T>(rpcName: string, params: Record<string, unknown>): QueryResult<T> {
      const [data, setData] = useState<T | undefined>(undefined)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState<Error | undefined>(undefined)

      // JSON.stringify gives a stable dep for a plain params object. This is
      // intentional — the compiled output passes object literals that would
      // otherwise trigger on every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const serializedParams = JSON.stringify(params)

      useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(undefined)

        client.rpc<T>(rpcName, params).then(({ data: result, error: rpcError }) => {
          if (cancelled) return
          if (rpcError) {
            setError(new Error(rpcError.message))
          } else {
            setData(result ?? undefined)
          }
          setLoading(false)
        })

        return () => {
          cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [rpcName, serializedParams])

      return { data, loading, error }
    },

    useMutation<T>(
      rpcName: string,
      currentParams: Record<string, unknown>,
    ): MutationTuple<T> {
      const paramsRef = useRef(currentParams)
      paramsRef.current = currentParams

      const [loading, setLoading] = useState(false)
      const [error, setError] = useState<Error | undefined>(undefined)

      const mutate = useCallback(async () => {
        setLoading(true)
        setError(undefined)
        try {
          const { data, error: rpcError } = await client.rpc<T>(rpcName, paramsRef.current)
          if (rpcError) throw new Error(rpcError.message)
          return data ?? undefined
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e))
          setError(err)
          return undefined
        } finally {
          setLoading(false)
        }
      }, [rpcName])

      return [mutate, { loading, error }]
    },
  }
}
