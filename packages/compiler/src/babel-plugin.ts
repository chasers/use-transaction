// Babel plugin stub — full implementation in Phase 2/3
import type { PluginObj } from '@babel/core'
import type { CompilerOptions } from './types.js'

export function babelPlugin(_options: CompilerOptions): PluginObj {
  return {
    name: 'use-transaction',
    visitor: {},
  }
}
