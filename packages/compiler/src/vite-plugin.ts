// Vite plugin stub — full implementation in Phase 5
import type { Plugin } from 'vite'
import type { CompilerOptions } from './types.js'

export function vitePlugin(_options: CompilerOptions): Plugin {
  return {
    name: 'use-transaction',
  }
}
