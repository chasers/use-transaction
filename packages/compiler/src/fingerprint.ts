import { createHash } from 'node:crypto'

export function normalizeSQL(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

// Hash uses positional $1/$2 placeholders so renaming a param variable doesn't
// produce a new migration — only a change to the SQL structure does.
export function fingerprintSQL(canonicalSQL: string): string {
  return createHash('sha256').update(normalizeSQL(canonicalSQL), 'utf8').digest('hex').slice(0, 8)
}

export function toFunctionName(hash: string): string {
  return `ut_${hash}`
}
