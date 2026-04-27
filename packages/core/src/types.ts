export type SecurityMode = 'invoker' | 'definer'

export interface TransactionOptions {
  security?: SecurityMode
}

export interface SqlFunction {
  name: string
  sql: string
  params: SqlParam[]
  hash: string
  security: SecurityMode
}

export interface SqlParam {
  name: string
  index: number
}

export interface FetcherAdapter {
  useQuery<T>(rpcName: string, params: Record<string, unknown>): QueryResult<T>
  useMutation<T>(rpcName: string): MutationResult<T>
}

export interface QueryResult<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

export type MutationTuple<T> = [
  (params: Record<string, unknown>) => Promise<T>,
  { loading: boolean; error: Error | undefined },
]

export type MutationResult<T> = MutationTuple<T>
