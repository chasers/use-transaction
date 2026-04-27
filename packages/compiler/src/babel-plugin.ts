import type { PluginObj, PluginPass } from '@babel/core'
import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'
import { extractTaggedTemplate } from './extractor.js'
import { rewriteTaggedTemplate, injectImport } from './rewriter.js'
import type { CompilerOptions } from './types.js'

export function babelPlugin(_api: unknown, options: CompilerOptions): PluginObj<PluginPass> {
  const emitted = new Map<string, true>()

  return {
    name: 'use-transaction',
    visitor: {
      Program: {
        exit(programPath, state) {
          const filename = state.filename ?? '<unknown>'
          const neededFunctions = new Set<string>()

          programPath.traverse({
            TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>) {
              const extracted = extractTaggedTemplate(path, filename)
              if (!extracted) return

              const { sqlFunction, hookName } = extracted

              if (!emitted.has(sqlFunction.hash)) {
                emitted.set(sqlFunction.hash, true)
                void options.adapter.emit(sqlFunction)
              }

              rewriteTaggedTemplate(path, extracted)

              neededFunctions.add(
                hookName === 'useTransaction' ? '_useTransactionRpc' : '_useTransactionMutationRpc',
              )
            },
          })

          injectImport(programPath, neededFunctions)
        },
      },
    },
  }
}
