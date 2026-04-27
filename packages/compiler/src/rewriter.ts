import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
import type { ExtractedCall } from './extractor.js'

const CORE_PACKAGE = '@use-transaction/core'
const QUERY_RPC = '_useTransactionRpc'
const MUTATION_RPC = '_useTransactionMutationRpc'

export function rewriteTaggedTemplate(
  path: NodePath<t.TaggedTemplateExpression>,
  extracted: ExtractedCall,
): void {
  const { sqlFunction, hookName } = extracted
  const rpcFn = hookName === 'useTransaction' ? QUERY_RPC : MUTATION_RPC

  const paramsObj = t.objectExpression(
    sqlFunction.params.map((param) =>
      t.objectProperty(t.identifier(param.name), t.identifier(param.name), false, true),
    ),
  )

  const rpcCall = t.callExpression(t.identifier(rpcFn), [
    t.stringLiteral(sqlFunction.name),
    paramsObj,
  ])

  // Preserve TypeScript generic type parameters: useTransaction<Row[]>`...`
  // Guard against Flow's TypeParameterInstantiation which has a different shape.
  if (path.node.typeParameters && t.isTSTypeParameterInstantiation(path.node.typeParameters)) {
    rpcCall.typeParameters = path.node.typeParameters
  }

  path.replaceWith(rpcCall)
}

// Adds or updates the @use-transaction/core import to include the needed RPC specifiers.
export function injectImport(
  programPath: NodePath<t.Program>,
  neededFunctions: Set<string>,
): void {
  if (neededFunctions.size === 0) return

  // Find an existing import from @use-transaction/core
  const existing = programPath.node.body.find(
    (node): node is t.ImportDeclaration =>
      t.isImportDeclaration(node) && node.source.value === CORE_PACKAGE,
  )

  if (existing) {
    // Add any missing specifiers to the existing import
    for (const fn of neededFunctions) {
      const alreadyImported = existing.specifiers.some(
        (s) => t.isImportSpecifier(s) && t.isIdentifier(s.local, { name: fn }),
      )
      if (!alreadyImported) {
        existing.specifiers.push(
          t.importSpecifier(t.identifier(fn), t.identifier(fn)),
        )
      }
    }
  } else {
    const specifiers = [...neededFunctions].map((fn) =>
      t.importSpecifier(t.identifier(fn), t.identifier(fn)),
    )
    programPath.unshiftContainer('body', [
      t.importDeclaration(specifiers, t.stringLiteral(CORE_PACKAGE)),
    ])
  }
}
