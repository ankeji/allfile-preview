/** vite 的 ?raw 导入（以字符串形式内联文件内容） */
declare module '*?raw' {
  const content: string
  export default content
}
