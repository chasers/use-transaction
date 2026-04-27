import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { compile } from './compile.js'

let srcDir: string
let outDir: string

beforeEach(async () => {
  const base = join(tmpdir(), `ut-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  srcDir = join(base, 'src')
  outDir = join(base, 'migrations')
  await mkdir(srcDir, { recursive: true })
})

afterEach(async () => {
  await rm(join(srcDir, '..'), { recursive: true, force: true })
})

async function write(name: string, code: string) {
  await writeFile(join(srcDir, name), code, 'utf8')
}

async function getMigrationFiles(): Promise<string[]> {
  try {
    const files = await readdir(outDir)
    return files.filter((f) => f.endsWith('.sql'))
  } catch {
    return []
  }
}

describe('compile command', () => {
  it('emits a migration file for a useTransaction call', async () => {
    await write('query.ts', 'useTransaction`SELECT 1`')
    const result = await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.emitted).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(await getMigrationFiles()).toHaveLength(1)
  })

  it('returns scanned count equal to files with useTransaction', async () => {
    await write('a.ts', 'useTransaction`SELECT 1`')
    await write('b.ts', 'const x = 1') // no useTransaction
    const result = await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.scanned).toBe(1)
  })

  it('emits one migration per unique query across multiple files', async () => {
    await write('a.ts', 'useTransaction`SELECT 1`')
    await write('b.ts', 'useTransaction`SELECT 2`')
    const result = await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.emitted).toBe(2)
    expect(await getMigrationFiles()).toHaveLength(2)
  })

  it('is idempotent — running twice does not duplicate migrations', async () => {
    await write('query.ts', 'useTransaction`SELECT 1`')
    await compile('**/*.ts', { output: outDir, cwd: srcDir })
    await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(await getMigrationFiles()).toHaveLength(1)
  })

  it('handles useTransactionMutation', async () => {
    await write('mut.ts', 'useTransactionMutation`INSERT INTO t (x) VALUES (${x}) RETURNING id`')
    const result = await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.emitted).toBe(1)
  })

  it('collects CompilerErrors and continues with other files', async () => {
    await write('bad.ts', 'useTransaction`SELECT ${someFunc()}`')
    await write('good.ts', 'useTransaction`SELECT 1`')
    const result = await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.errors).toHaveLength(1)
    expect(result.emitted).toBe(1)
  })

  it('returns non-empty errors array on CompilerError', async () => {
    await write('bad.ts', 'useTransaction`SELECT ${a + b}`')
    const result = await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.errors[0]).toContain('bad.ts')
  })

  it('returns zero emitted when no files match the pattern', async () => {
    const result = await compile('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.emitted).toBe(0)
    expect(result.scanned).toBe(0)
  })
})
