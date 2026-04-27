import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { scanSourceFiles } from './scan.js'

export interface CheckOptions {
  output: string
  cwd?: string
}

export interface CheckResult {
  ok: boolean
  missing: Array<{ name: string; hash: string; source?: string }>
  errors: string[]
}

async function getEmittedHashes(outputDir: string): Promise<Set<string>> {
  const hashes = new Set<string>()
  let files: string[]
  try {
    files = await readdir(outputDir)
  } catch {
    return hashes
  }
  for (const file of files) {
    if (!file.endsWith('.sql')) continue
    const content = await readFile(join(outputDir, file), 'utf8')
    const match = /-- hash: ([0-9a-f]+)/.exec(content)
    if (match?.[1]) hashes.add(match[1])
  }
  return hashes
}

export async function check(pattern: string, options: CheckOptions): Promise<CheckResult> {
  const cwd = options.cwd ?? process.cwd()
  const [results, emittedHashes] = await Promise.all([
    scanSourceFiles(pattern, cwd),
    getEmittedHashes(options.output),
  ])

  const missing: CheckResult['missing'] = []
  const errors: string[] = []

  for (const result of results) {
    if (result.error) {
      errors.push(result.error.message)
      continue
    }
    for (const fn of result.functions) {
      if (!emittedHashes.has(fn.hash)) {
        const entry: CheckResult['missing'][number] = { name: fn.name, hash: fn.hash }
        if (fn.source) entry.source = `${fn.source.file}:${fn.source.line}`
        missing.push(entry)
      }
    }
  }

  return { ok: missing.length === 0 && errors.length === 0, missing, errors }
}
