import { createHash } from 'node:crypto'

export function normalizeSQL(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

// Hash uses positional $1/$2 placeholders so renaming a param variable doesn't
// produce a new migration — only a change to the SQL structure does.
export function fingerprintSQL(canonicalSQL: string): string {
  return createHash('sha256').update(normalizeSQL(canonicalSQL), 'utf8').digest('hex').slice(0, 8)
}

// Converts a developer-supplied label to a Postgres-safe snake_case slug.
// e.g. "listUsersByOrg" → "list_users_by_org"
//      "get users" → "get_users"
export function slugifyLabel(label: string): string {
  return label
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

// ut_<slug>_<hash> when a label is provided; ut_<hash> otherwise.
export function toFunctionName(hash: string, label?: string): string {
  if (label) return `ut_${slugifyLabel(label)}_${hash}`
  return `ut_${hash}`
}
