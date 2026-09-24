import { defineConfig } from 'vite'

// react / @allfile-preview/core 为 peerDependencies，不打入产物
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs')
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', /^@allfile-preview\/core/]
    },
    sourcemap: true,
    emptyOutDir: true
  }
})
