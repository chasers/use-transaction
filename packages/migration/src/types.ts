export type SecurityMode = 'invoker' | 'definer'
export type SqlFunctionType = 'query' | 'mutation'

export interface SqlParam {
  name: string
  index: number
}

export interface SqlFunction {
  name: string
  sql: string
  params: SqlParam[]
  hash: string
  security: SecurityMode
  type: SqlFunctionType
  source?: { file: string; line: number }
}

export interface MigrationAdapter {
  emit(fn: SqlFunction): Promise<void>
}
