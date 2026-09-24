import { defineConfig } from 'vite'

// 双 mode 构建：
// - esm：产物 dist/index.js，lit 作为 external（由 npm 安装时自动带入 dependencies）
// - umd：产物 dist/allfile-preview.umd.cjs，lit 内联，全局变量 FilePreview，供 <script> 标签直接引入
export default defineConfig(({ mode }) => {
  const isUmd = mode === 'umd'
  return {
    build: {
      lib: {
        entry: 'src/index.ts',
        formats: isUmd ? ['umd'] : ['es'],
        name: 'FilePreview',
        fileName: () => (isUmd ? 'allfile-preview.umd.cjs' : 'index.js')
      },
      // esm 产物不打包第三方依赖（由 npm 安装时自动带入 dependencies）；umd 全量内联。
      // 例外："?raw" 结尾的导入（pdf worker 内联字符串）必须留在包内参与构建
      rollupOptions: isUmd
        ? undefined
        : {
            external: (id: string) =>
              !id.endsWith('?raw') && /^(lit|pdfjs-dist|docx-preview|jszip|xlsx|marked)/.test(id)
          },
      target: isUmd ? 'es2018' : 'es2021',
      sourcemap: true,
      outDir: 'dist',
      // 第二次构建（umd）不能清空 esm 产物；esm 先跑并负责清空
      emptyOutDir: !isUmd
    }
  }
})
