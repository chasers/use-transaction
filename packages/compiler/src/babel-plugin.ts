import type { PluginObj, PluginPass } from '@babel/core'
import * as t from '@babel/types'
import { extractTaggedTemplate } from './extractor.js'
import type { CompilerOptions } from './types.js'

export function babelPlugin(options: CompilerOptions): PluginObj<PluginPass> {
  const emitted = new Map<string, true>()

  return {
    name: 'use-transaction',
    visitor: {
      TaggedTemplateExpression(path, state) {
        const filename = state.filename ?? '<unknown>'
        const extracted = extractTaggedTemplate(path, filename)
        if (!extracted) return

        const { sqlFunction } = extracted

        // Emit each unique function once per build
        if (!emitted.has(sqlFunction.hash)) {
          emitted.set(sqlFunction.hash, true)
          // Fire-and-forget — rewrite (Phase 3) will replace the call site
          void options.adapter.emit(sqlFunction)
        }

        // TODO Phase 3: rewrite this TaggedTemplateExpression to an RPC call
      },
    },
  }
}
