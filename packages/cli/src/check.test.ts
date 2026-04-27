import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { compile } from './compile.js'
import { check } from './check.js'

let srcDir: string
let outDir: string

beforeEach(async () => {
  const base = join(tmpdir(), `ut-cli-check-${Date.now()}-${Math.random().toString(36).slice(2)}`)
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

describe('check command', () => {
  it('returns ok when all queries have been compiled', async () => {
    await write('query.ts', 'useTransaction`SELECT 1`')
    await compile('**/*.ts', { output: outDir, cwd: srcDir })
    const result = await check('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.ok).toBe(true)
    expect(result.missing).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('returns ok: false when a query has not been compiled', async () => {
    await write('query.ts', 'useTransaction`SELECT 1`')
    // intentionally skip compile
    const result = await check('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.ok).toBe(false)
    expect(result.missing).toHaveLength(1)
  })

  it('includes the function name and hash in missing entries', async () => {
    await write('query.ts', 'useTransaction`SELECT 1`')
    const result = await check('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.missing[0]).toMatchObject({
      name: expect.stringMatching(/^ut_[0-9a-f]{8}$/),
      hash: expect.stringMatching(/^[0-9a-f]{8}$/),
    })
  })

  it('includes the source location in missing entries', async () => {
    await write('query.ts', 'useTransaction`SELECT 1`')
    const result = await check('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.missing[0]?.source).toContain('query.ts')
  })

  it('is ok when no files match the pattern', async () => {
    const result = await check('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.ok).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('reports one missing entry per unique uncompiled query', async () => {
    await write('a.ts', 'useTransaction`SELECT 1`')
    await write('b.ts', 'useTransaction`SELECT 2`')
    // Only compile the first
    await compile('**/a.ts', { output: outDir, cwd: srcDir })
    const result = await check('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.ok).toBe(false)
    expect(result.missing).toHaveLength(1)
  })

  it('collects CompilerErrors and marks result not ok', async () => {
    await write('bad.ts', 'useTransaction`SELECT ${someFunc()}`')
    const result = await check('**/*.ts', { output: outDir, cwd: srcDir })
    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
  })
})
