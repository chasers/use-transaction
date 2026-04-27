import { DefaultAdapter } from '@use-transaction/migration'
import { scanSourceFiles } from './scan.js'

export interface CompileOptions {
  output: string
  cwd?: string
}

export interface CompileResult {
  scanned: number
  emitted: number
  errors: string[]
}

export async function compile(pattern: string, options: CompileOptions): Promise<CompileResult> {
  const cwd = options.cwd ?? process.cwd()
  const adapter = new DefaultAdapter({ outputDir: options.output })
  const results = await scanSourceFiles(pattern, cwd)

  const errors: string[] = []
  let emitted = 0

  for (const result of results) {
    if (result.error) {
      errors.push(result.error.message)
      continue
    }
    for (const fn of result.functions) {
      await adapter.emit(fn)
      emitted++
    }
  }

  return { scanned: results.length, emitted, errors }
}
