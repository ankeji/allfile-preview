# @allfile-preview/react

[`@allfile-preview/core`](https://www.npmjs.com/package/@allfile-preview/core) 的 React 封装组件：事件自动桥接，**无需 `addEventListener`**，支持 **React 16.8+**（含 17 / 18 / 19）。

支持预览的文件类型与全部功能（图片 / 视频 / 音频 / PDF / TXT / Markdown / Word / Excel、缩放、水印、下载、自定义操作栏等）见 [core 文档](https://www.npmjs.com/package/@allfile-preview/core)。**在线体验**：<https://allfile-preview.softinstall.top/>

## 安装

```bash
npm install @allfile-preview/react @allfile-preview/core
```

- `@allfile-preview/core` 为 peer 依赖，必须同时安装（负责注册 `<file-preview>` 自定义元素）
- 组件导出 ESM 与 CJS 两种格式

## 快速开始

```tsx
import { useRef } from 'react'
import { FilePreview } from '@allfile-preview/react'
import '@allfile-preview/core'

export default function App() {
  const preview = useRef<any>(null)

  return (
    <div>
      <FilePreview
        ref={preview}
        src="/media/movie.mp4"
        type="video"
        name="示例.mp4"
        color="#10b981"
        downloadable
        onLoad={(d) => console.log('加载完成', d)}
        onError={(d) => console.log(d.message)}
        onTimeupdate={(d) => console.log(d.currentTime)}
      />
      <button onClick={() => preview.current?.play()}>播放</button>
    </div>
  )
}
```

React ≤18 无法声明式绑定自定义元素事件，本组件内部通过 `ref + addEventListener` 桥接（回调经 ref 保持最新闭包，不会过期），属性以 DOM property 方式赋值，与 Lit 响应式属性语义一致。

## Props

与 `<file-preview>` 元素属性一一对应：

| Prop | 类型 / 默认值 | 说明 |
|---|---|---|
| `src` | string / `''` | 文件地址（http / blob / data URL） |
| `type` | `'image' \| 'video' \| 'audio' \| 'pdf' \| 'text' \| 'markdown' \| 'docx' \| 'xlsx' \| 'auto'` / `auto` | auto 时自动检测 |
| `name` | string / `''` | 文件名（扩展名参与检测；audio 模式下作标题） |
| `mime` | string / `''` | MIME 提示 |
| `poster` | string / `''` | 视频/音频封面 |
| `autoplay` / `muted` / `loop` | boolean / false | 媒体播放控制 |
| `preload` | string / `'metadata'` | 预加载策略 |
| `crossorigin` | string / `''` | CORS 属性 |
| `color` | string / `''` | 主题色 |
| `cMapUrl` | string / `''` | pdfjs cMaps 目录（中文等非嵌入字体 PDF 需要） |
| `downloadable` | boolean / false | 操作栏显示下载按钮 |
| `actions` | string / array / `''` | 操作栏自定义按钮，每项 `{ key, label, danger? }` |
| `controls` | string / object / array / `''` | 播放器控件配置（仅 video / audio 生效，对象覆盖式或数组白名单） |
| `watermark` | string / object / `''` | 水印配置（所有预览类型生效）：`{ text, image, width, height, fontSize, color, opacity, rotate, gap }` |
| `className` / `style` | string / CSSProperties | 透传到根元素 |

## 事件

与 core 的 CustomEvent 一一对应，回调参数即 `event.detail`：

`onLoad` `onError` `onZoom` `onRotate` `onReset` `onPlay` `onPause` `onEnded` `onTimeupdate` `onSeek` `onVolumechange` `onRatechange` `onFullscreenchange` `onPagechange` `onDownload` `onAction`

各事件 detail 结构见 [core 文档事件表](https://www.npmjs.com/package/@allfile-preview/core)。

## 命令式方法（ref 调用）

```tsx
const preview = useRef<FilePreviewElement>(null)

preview.current?.play()            // 播放
preview.current?.pause()           // 暂停
preview.current?.seek(30)          // 跳转
preview.current?.skip(-15)         // 快退 15 秒
preview.current?.setRate(1.5)      // 倍速
preview.current?.goToPage(3)       // PDF 跳页
preview.current?.zoomTo(2)         // 缩放
preview.current?.fitWidth()        // 适应宽度
preview.current?.rotateBy(90)      // 旋转
preview.current?.reset()           // 重置
preview.current?.download()        // 下载
preview.current?.reload()          // 重新加载
```

`FilePreviewElement` 类型可从 `@allfile-preview/core` 导入。

## License

MIT
