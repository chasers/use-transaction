import { defineConfig } from 'vite'
import { vitePlugin } from '@use-transaction/compiler'
import { DefaultAdapter } from '@use-transaction/migration'

export default defineConfig({
  plugins: [
    vitePlugin({
      adapter: new DefaultAdapter({ outputDir: './supabase/migrations' }),
    }),
  ],
})
