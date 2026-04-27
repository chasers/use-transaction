import type { SourceLocation } from '@babel/types'

export class CompilerError extends Error {
  constructor(
    message: string,
    public readonly filename: string,
    public readonly loc?: SourceLocation | null,
  ) {
    const position = loc ? `:${loc.start.line}:${loc.start.column + 1}` : ''
    super(`@use-transaction/compiler: ${message}\n  at ${filename}${position}`)
    this.name = 'CompilerError'
  }
}
