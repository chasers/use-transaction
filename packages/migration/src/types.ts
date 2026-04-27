export type SecurityMode = 'invoker' | 'definer'

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
}

export interface MigrationAdapter {
  emit(fn: SqlFunction): Promise<void>
}
