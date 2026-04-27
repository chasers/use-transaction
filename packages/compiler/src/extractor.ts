import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { NodePath, TraverseOptions } from '@babel/traverse'
import type { SqlFunction, SqlParam, SecurityMode } from '@use-transaction/migration'
import { fingerprintSQL, toFunctionName } from './fingerprint.js'
import { CompilerError } from './errors.js'

// @babel/traverse uses `export =` which moduleResolution:NodeNext won't type as
// callable on a default import. Cast to an explicit function type.
type TraverseFn = (parent: t.Node, opts?: TraverseOptions) => void
const traverse = (
  (_traverse as unknown as { default: TraverseFn }).default ?? _traverse
) as TraverseFn

const HOOK_NAMES = new Set(['useTransaction', 'useTransactionMutation'])

// Parse a TypeScript/TSX source string and extract all useTransaction calls.
export function extractFromSource(code: string, filename = '<unknown>'): ExtractedCall[] {
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
  const results: ExtractedCall[] = []

  traverse(ast, {
    TaggedTemplateExpression(path) {
      const result = extractTaggedTemplate(path, filename)
      if (result) results.push(result)
    },
  })

  return results
}

export type HookName = 'useTransaction' | 'useTransactionMutation'

export interface ExtractedCall {
  sqlFunction: SqlFunction
  hookName: HookName
}

interface ExtractedOptions {
  security: SecurityMode
  label: string | undefined
}

// Returns null if the path is not a useTransaction/useTransactionMutation call.
export function extractTaggedTemplate(
  path: NodePath<t.TaggedTemplateExpression>,
  filename: string,
): ExtractedCall | null {
  const { tag, quasi } = path.node

  let hookName: HookName
  let options: ExtractedOptions = { security: 'invoker', label: undefined }

  if (t.isIdentifier(tag) && HOOK_NAMES.has(tag.name)) {
    hookName = tag.name as HookName
  } else if (
    t.isCallExpression(tag) &&
    t.isIdentifier(tag.callee) &&
    HOOK_NAMES.has(tag.callee.name)
  ) {
    hookName = tag.callee.name as HookName
    options = extractOptions(tag.arguments, path, filename)
  } else {
    return null
  }

  const params = extractParams(quasi.expressions, path, filename)
  const canonicalSQL = buildCanonicalSQL(quasi.quasis, params.length)
  const bodySQL = buildBodySQL(quasi.quasis, params)
  const hash = fingerprintSQL(canonicalSQL)
  const line = path.node.loc?.start.line

  return {
    hookName,
    sqlFunction: {
      name: toFunctionName(hash, options.label),
      sql: bodySQL,
      params,
      hash,
      security: options.security,
      type: hookName === 'useTransaction' ? 'query' : 'mutation',
      source: { file: filename, line: line ?? 0 },
    },
  }
}

function extractOptions(
  args: t.CallExpression['arguments'],
  path: NodePath,
  filename: string,
): ExtractedOptions {
  const result: ExtractedOptions = { security: 'invoker', label: undefined }
  const options = args[0]
  if (!options || !t.isObjectExpression(options)) return result

  for (const prop of options.properties) {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue

    if (prop.key.name === 'security' && t.isStringLiteral(prop.value)) {
      const val = prop.value.value
      if (val === 'invoker' || val === 'definer') {
        result.security = val
      } else {
        throw new CompilerError(
          `Invalid security option "${val}". Must be "invoker" or "definer".`,
          filename,
          prop.value.loc,
        )
      }
    }

    if (prop.key.name === 'label' && t.isStringLiteral(prop.value)) {
      result.label = prop.value.value
    }
  }

  return result
}

function extractParams(
  expressions: t.TaggedTemplateExpression['quasi']['expressions'],
  path: NodePath,
  filename: string,
): SqlParam[] {
  return expressions.map((expr, index) => {
    if (t.isIdentifier(expr)) {
      return { name: expr.name, index }
    }

    const exprType = expr.type
    throw new CompilerError(
      `Invalid interpolation in useTransaction (got ${exprType}).\n` +
        `  Only simple identifiers are allowed: \${myVar}\n` +
        `  Hint: assign the value to a variable first.\n` +
        `  e.g. const value = ${exprType === 'CallExpression' ? 'someFunc()' : 'expr'}; useTransaction\`...${'{value}'}...\``,
      filename,
      expr.loc,
    )
  })
}

// Canonical form uses $1/$2 positional placeholders so that renaming a variable
// does not change the hash and produce a new migration.
function buildCanonicalSQL(quasis: t.TemplateElement[], paramCount: number): string {
  let sql = ''
  for (let i = 0; i < quasis.length; i++) {
    sql += quasis[i]?.value.cooked ?? quasis[i]?.value.raw ?? ''
    if (i < paramCount) sql += `$${i + 1}`
  }
  return sql
}

// Body SQL uses the identifier names so the Postgres function body can reference
// parameters by name.
function buildBodySQL(quasis: t.TemplateElement[], params: SqlParam[]): string {
  let sql = ''
  for (let i = 0; i < quasis.length; i++) {
    sql += quasis[i]?.value.cooked ?? quasis[i]?.value.raw ?? ''
    if (i < params.length) sql += params[i]?.name ?? `$${i + 1}`
  }
  return sql
}
