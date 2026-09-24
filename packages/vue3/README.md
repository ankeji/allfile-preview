# @allfile-preview/vue3

[`@allfile-preview/core`](https://www.npmjs.com/package/@allfile-preview/core) 的 Vue3 封装组件：类型完整的 props / emits，**无需配置 `isCustomElement`**，在 SFC / JSX / 模板中直接使用。

支持预览的文件类型与全部功能（图片 / 视频 / 音频 / PDF / TXT / Markdown / Word / Excel、缩放、水印、下载、自定义操作栏等）见 [core 文档](https://www.npmjs.com/package/@allfile-preview/core)。**在线体验**：<https://allfile-preview.softinstall.top/>

## 安装

```bash
npm install @allfile-preview/vue3 @allfile-preview/core
```

- `@allfile-preview/core` 为 peer 依赖，必须同时安装（负责注册 `<file-preview>` 自定义元素）
- 组件导出 ESM 与 CJS 两种格式

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { FilePreview } from '@allfile-preview/vue3'
import '@allfile-preview/core'

const url = ref('/media/movie.mp4')
const preview = ref()

function onZoom(detail: { scale: number }) {
  console.log('缩放：', detail.scale)
}
function play() {
  preview.value?.play() // 命令式 API
}
</script>

<template>
  <FilePreview
    ref="preview"
    :src="url"
    type="video"
    name="示例.mp4"
    color="#10b981"
    downloadable
    @load="onZoom"
    @zoom="onZoom"
    @error="(d) => console.log(d.message)"
    @timeupdate="(d) => console.log(d.currentTime)"
  />
</template>
```

## Props

与 `<file-preview>` 元素属性一一对应（组件内部以 DOM property 方式透传，与 Lit 响应式属性语义一致）：

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

## 事件

与 core 的 CustomEvent 一一对应，回调参数即 `event.detail`：

`@load` `@error` `@zoom` `@rotate` `@reset` `@play` `@pause` `@ended` `@timeupdate` `@seek` `@volumechange` `@ratechange` `@fullscreenchange` `@pagechange` `@download` `@action`

各事件 detail 结构见 [core 文档事件表](https://www.npmjs.com/package/@allfile-preview/core)。

## 命令式方法（ref 调用）

```ts
const preview = ref()

preview.value?.play()            // 播放
preview.value?.pause()           // 暂停
preview.value?.seek(30)          // 跳转
preview.value?.skip(-15)         // 快退 15 秒
preview.value?.setRate(1.5)      // 倍速
preview.value?.goToPage(3)       // PDF 跳页
preview.value?.zoomTo(2)         // 缩放
preview.value?.fitWidth()        // 适应宽度
preview.value?.rotateBy(90)      // 旋转
preview.value?.reset()           // 重置
preview.value?.download()        // 下载
preview.value?.reload()          // 重新加载
preview.value?.el                // 内部 <file-preview> 元素
```

## 与直接使用自定义元素的对比

| | 直接用 `<file-preview>` | 用本封装组件 |
|---|---|---|
| vite 配置 | 需 `isCustomElement` | 无需 |
| 事件 | 手动 `addEventListener` | `@load` 等模板绑定 |
| 类型提示 | 弱 | 完整 props / emits / 方法 |
| 属性响应 | DOM attribute | Vue 响应式透传 |

## License

MIT
