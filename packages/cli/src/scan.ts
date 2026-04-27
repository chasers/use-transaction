import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'
import { extractFromSource, CompilerError } from '@use-transaction/compiler'
import type { SqlFunction } from '@use-transaction/migration'

export interface ScanResult {
  file: string
  functions: SqlFunction[]
  error?: CompilerError
}

export async function scanSourceFiles(pattern: string, cwd: string): Promise<ScanResult[]> {
  const files = await fg(pattern, { cwd, absolute: true })
  const results: ScanResult[] = []

  for (const file of files) {
    const code = await readFile(file, 'utf8')
    if (!code.includes('useTransaction')) continue

    try {
      const extracted = extractFromSource(code, file)
      if (extracted.length > 0) {
        results.push({ file, functions: extracted.map((e) => e.sqlFunction) })
      }
    } catch (err) {
      if (err instanceof CompilerError) {
        results.push({ file, functions: [], error: err })
      } else {
        throw err
      }
    }
  }

  return results
}
