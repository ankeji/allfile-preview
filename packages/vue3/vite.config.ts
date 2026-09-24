import { defineConfig } from 'vite'

// vue 与 @allfile-preview/core 均为 peerDependencies，不打入产物
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs')
    },
    rollupOptions: {
      external: ['vue', /^@allfile-preview\/core/]
    },
    sourcemap: true,
    emptyOutDir: true
  }
})
