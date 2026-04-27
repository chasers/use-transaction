#!/usr/bin/env node
import { Command } from 'commander'
import { compile } from './compile.js'
import { check } from './check.js'

const program = new Command()

program.name('use-transaction').description('Extract SQL from source files and emit migrations')

program
  .command('compile')
  .description('Scan source files and emit a migration file for each unique useTransaction call')
  .argument('[pattern]', 'glob pattern for source files', 'src/**/*.{ts,tsx}')
  .option('-o, --output <dir>', 'migration output directory', 'supabase/migrations')
  .action(async (pattern: string, opts: { output: string }) => {
    const result = await compile(pattern, { output: opts.output })
    for (const err of result.errors) {
      console.error(`error: ${err}`)
    }
    console.log(`compiled ${result.emitted} queries from ${result.scanned} files`)
    if (result.errors.length > 0) process.exit(1)
  })

program
  .command('check')
  .description('Verify all useTransaction calls have been compiled (non-zero exit if any are missing)')
  .argument('[pattern]', 'glob pattern for source files', 'src/**/*.{ts,tsx}')
  .option('-o, --output <dir>', 'migration output directory', 'supabase/migrations')
  .action(async (pattern: string, opts: { output: string }) => {
    const result = await check(pattern, { output: opts.output })
    for (const err of result.errors) {
      console.error(`error: ${err}`)
    }
    for (const m of result.missing) {
      const loc = m.source ? ` (${m.source})` : ''
      console.error(`missing migration: ${m.name} [${m.hash}]${loc}`)
    }
    if (result.ok) {
      console.log('all queries compiled')
    } else {
      process.exit(1)
    }
  })

await program.parseAsync()
