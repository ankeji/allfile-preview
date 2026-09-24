import { defineConfig } from 'vite'
import vue2 from '@vitejs/plugin-vue2'
import { resolve } from 'node:path'

// dev 模式直接引用 core 源码，无需预构建 dist
export default defineConfig({
  plugins: [vue2()],
  resolve: {
    alias: {
      '@allfile-preview/core': resolve(__dirname, '../../packages/core/src/index.ts')
    }
  },
  server: {
    port: 5172
  }
})
