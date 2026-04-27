import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DefaultAdapter } from './default.js'
import type { SqlFunction } from './types.js'

function makeFn(overrides: Partial<SqlFunction> = {}): SqlFunction {
  return {
    name: 'ut_abc12345',
    sql: 'SELECT id FROM users WHERE org = orgId',
    params: [{ name: 'orgId', index: 0 }],
    hash: 'abc12345',
    security: 'invoker',
    type: 'query',
    ...overrides,
  }
}

let outputDir: string

beforeEach(async () => {
  outputDir = join(tmpdir(), `use-transaction-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
})

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true })
})

async function getSqlFiles(): Promise<string[]> {
  const files = await readdir(outputDir)
  return files.filter((f) => f.endsWith('.sql'))
}

async function readSqlFile(): Promise<string> {
  const files = await getSqlFiles()
  expect(files).toHaveLength(1)
  return readFile(join(outputDir, files[0]!), 'utf8')
}

describe('DefaultAdapter', () => {
  it('creates the outputDir if it does not exist', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn())
    const files = await getSqlFiles()
    expect(files).toHaveLength(1)
  })

  it('creates a .sql file named <timestamp>_<name>.sql', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn())
    const [file] = await getSqlFiles()
    expect(file).toMatch(/^\d{14}_ut_abc12345\.sql$/)
  })

  it('writes the hash comment for idempotency detection', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn())
    const content = await readSqlFile()
    expect(content).toContain('-- hash: abc12345')
  })

  it('writes the source comment when source is provided', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn({ source: { file: 'src/components/UserList.tsx', line: 14 } }))
    const content = await readSqlFile()
    expect(content).toContain('-- source: src/components/UserList.tsx:14')
  })

  it('omits the source comment when source is not provided', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn()) // makeFn does not set source by default
    const content = await readSqlFile()
    expect(content).not.toContain('-- source:')
  })

  it('writes CREATE OR REPLACE FUNCTION with the function name', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn())
    const content = await readSqlFile()
    expect(content).toContain('CREATE OR REPLACE FUNCTION ut_abc12345')
  })

  it('writes parameter names and text types', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn())
    const content = await readSqlFile()
    expect(content).toContain('"orgId" text')
  })

  it('writes no parameters when params is empty', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn({ params: [], sql: 'SELECT 1', hash: 'no_params0' }))
    const content = await readSqlFile()
    expect(content).toContain('CREATE OR REPLACE FUNCTION ut_abc12345()')
  })

  it('includes the SQL body in the function', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn())
    const content = await readSqlFile()
    expect(content).toContain('SELECT id FROM users WHERE org = orgId')
  })

  it('writes SECURITY INVOKER for invoker security', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn({ security: 'invoker' }))
    const content = await readSqlFile()
    expect(content).toContain('SECURITY INVOKER')
    expect(content).not.toContain('SECURITY DEFINER')
  })

  it('writes SECURITY DEFINER when specified', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn({ security: 'definer' }))
    const content = await readSqlFile()
    expect(content).toContain('SECURITY DEFINER')
  })

  it('writes STABLE for query type', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(makeFn({ type: 'query' }))
    const content = await readSqlFile()
    expect(content).toContain('STABLE')
  })

  it('does not write STABLE for mutation type', async () => {
    const adapter = new DefaultAdapter({ outputDir })
    await adapter.emit(
      makeFn({ type: 'mutation', sql: 'INSERT INTO t (x) VALUES (x) RETURNING id', hash: 'mutation1' }),
    )
    const content = await readSqlFile()
    expect(content).not.toContain('STABLE')
  })

  describe('idempotency', () => {
    it('does not create a second file for the same hash', async () => {
      const adapter = new DefaultAdapter({ outputDir })
      await adapter.emit(makeFn())
      await adapter.emit(makeFn())
      expect(await getSqlFiles()).toHaveLength(1)
    })

    it('does emit a new file when the hash differs', async () => {
      const adapter = new DefaultAdapter({ outputDir })
      await adapter.emit(makeFn({ hash: 'hash0001' }))
      await adapter.emit(makeFn({ name: 'ut_hash0002', hash: 'hash0002' }))
      expect(await getSqlFiles()).toHaveLength(2)
    })

    it('is idempotent across separate adapter instances pointing to the same dir', async () => {
      await new DefaultAdapter({ outputDir }).emit(makeFn())
      await new DefaultAdapter({ outputDir }).emit(makeFn())
      expect(await getSqlFiles()).toHaveLength(1)
    })
  })
})
