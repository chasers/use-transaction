import { transformSync } from '@babel/core'
import type { PluginItem } from '@babel/core'
import type { Plugin } from 'vite'
import { babelPlugin } from './babel-plugin.js'
import type { CompilerOptions } from './types.js'

const TRANSFORM_FILTER = /\.[jt]sx?$/
const HOOK_PATTERN = /useTransaction/

export function vitePlugin(options: CompilerOptions): Plugin {
  return {
    name: 'use-transaction',
    enforce: 'pre',
    transform(code, id) {
      if (!TRANSFORM_FILTER.test(id)) return null
      if (!HOOK_PATTERN.test(code)) return null

      const isTs = /\.tsx?$/.test(id)
      const isTsx = /\.tsx$/.test(id)
      const isJsx = /\.jsx$/.test(id)

      const syntaxPlugins: PluginItem[] = []
      if (isTs) {
        syntaxPlugins.push(['@babel/plugin-syntax-typescript', { allExtensions: true, isTSX: isTsx }])
      } else if (isJsx) {
        syntaxPlugins.push(['@babel/plugin-syntax-jsx'])
      }

      const result = transformSync(code, {
        filename: id,
        plugins: [...syntaxPlugins, [babelPlugin, options]],
        sourceMaps: true,
        configFile: false,
        babelrc: false,
      })

      if (!result?.code) return null
      return { code: result.code, map: result.map ?? null }
    },
  }
}
