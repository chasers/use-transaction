export type SecurityMode = 'invoker' | 'definer'

export interface TransactionOptions {
  security?: SecurityMode
}

export interface QueryResult<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

export type MutationTuple<T> = [
  () => Promise<T | undefined>,
  { loading: boolean; error: Error | undefined },
]

// Duck-typed to match the Supabase client's rpc() method, without importing it.
export interface RpcClient {
  rpc<T = unknown>(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: T | null; error: { message: string } | null }>
}

export interface FetcherAdapter {
  useQuery<T>(rpcName: string, params: Record<string, unknown>): QueryResult<T>
  // currentParams are passed at render time; the adapter must use a ref internally
  // so that mutate() always uses the latest values without being recreated.
  useMutation<T>(
    rpcName: string,
    currentParams: Record<string, unknown>,
  ): MutationTuple<T>
}
