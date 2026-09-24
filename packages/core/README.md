# @allfile-preview/core

跨框架**文件预览组件**：一套 Web Components，同时支持在**原生 HTML、Vue2、Vue3、React** 项目中使用。

支持 **图片 / 视频 / 音频 / PDF / TXT / Markdown / Word(docx) / Excel(xlsx)** 预览，**全部本地解析渲染，无任何外部 CDN 请求，局域网（离线）环境可用**。

Vue3 项目推荐搭配 [`@allfile-preview/vue3`](https://www.npmjs.com/package/@allfile-preview/vue3)（免 `isCustomElement` 配置的封装组件）；React 项目推荐搭配 [`@allfile-preview/react`](https://www.npmjs.com/package/@allfile-preview/react)。

## 特性

- **图片**：自适应展示、滚轮缩放（以光标为中心）、按钮缩放、适应宽度、旋转、拖拽平移、重置、缩放百分比；工具栏悬浮于预览区底部居中，按钮尺寸统一
- **视频 / 音频**：自定义统一风格播放器（播放/暂停、快退/快进、可拖拽进度条 + 缓冲显示、时间显示、音量 + 静音、倍速、循环、全屏（仅视频）、加载态、错误态 + 重试），控件可通过 `controls` 属性配置显隐与快进快退步长；音频为卡片式布局（封面 + 标题），视频支持点击画面切换播放
- **PDF**：pdf.js 本地渲染（底部页码栏：上一页/下一页/跳转；右上角悬浮缩放条：缩小/放大/适应宽度；高清渲染）；worker 以 Blob URL 内联，无需外部 worker 文件；`cMapUrl` 属性支持中文等非嵌入字体 PDF
- **TXT**：自动编码检测（UTF-8 / GB18030 / Big5 / Latin-1，中文 Windows 场景友好）+ 行号 + 右上角悬浮缩放条（缩小/放大/适应宽度，50% ~ 300%）+ 超大文件截断保护
- **Markdown**：marked 渲染（GFM 表格 / 任务列表 / 删除线 / 代码块 / 引用），自动编码检测，与 TXT 共用解码链，右上角悬浮缩放条（缩小/放大/适应宽度，50% ~ 300%）
- **Word（docx）**：docx-preview 渲染（标题 / 富文本 / 列表 / 表格 / 页眉页脚），右上角悬浮缩放条（缩小/放大/适应宽度），样式注入 Shadow DOM 内部不污染宿主页面；仅支持 .docx（.doc 老格式请先另存为 .docx）
- **Excel（xlsx / xls）**：SheetJS 解析，多工作表 tab 切换、合并单元格、列宽、数字右对齐、日期格式化，右上角悬浮缩放条（缩小/放大/适应宽度）
- **类型自动检测**：显式 `type` > `mime` 属性 > 文件名/URL 扩展名 > HEAD 请求读 Content-Type
- **主题定制**：`color` 属性或 CSS 变量一键换肤，所有类型预览的舞台背景可通过 `--fv-stage` 统一自定义
- **操作栏**：`downloadable` 开启下载按钮（所有文件类型可用，含图片/视频/音频）；`actions` 属性配置自定义按钮（如删除），点击经 `action` 事件携带文件信息回调，供调用业务接口
- **水印**：`watermark` 属性配置文字或图片水印（所有预览类型生效），大小、颜色、透明度、旋转、间距均可配，canvas 生成平铺图案覆盖预览区，不影响交互
- **错误友好化**：断网 / 跨域 / file:// 协议 / HTTP 404 / 加密文件 / 空表格等场景均有明确中文提示

## 安装

```bash
npm install @allfile-preview/core
```

解析库（pdfjs-dist / docx-preview / marked / xlsx / lit）已声明为依赖，安装时自动带入，构建器正常打包，运行时零外部请求。

## 快速开始

### 1. 原生 HTML（ESM）

```html
<script type="module">
  import '@allfile-preview/core' // 引入即注册所有自定义元素
</script>
<file-preview src="/media/sample.svg" type="image" name="图片.svg"></file-preview>
<script>
  document.querySelector('file-preview').addEventListener('zoom', (e) => console.log(e.detail.scale))
</script>
```

### 2. 原生 HTML（UMD 免构建）

把 `node_modules/@allfile-preview/core/dist/allfile-preview.umd.cjs` 复制到任意静态服务器，页面一个 `<script>` 引入即可（全量内联约 2.1MB，全局变量 `FilePreview`，支持 file:// 协议打开页面 + `<input type="file">` 转 blob URL 预览本地文件）：

```html
<script src="/assets/allfile-preview.umd.cjs"></script>
<file-preview src="a.mp4" type="video"></file-preview>
```

### 3. Vue2

`main.js` 配置一行（跳过自定义元素解析，否则有警告）：

```js
import Vue from 'vue'
import '@allfile-preview/core'
Vue.config.ignoredElements = [/^file-/]
```

```vue
<file-preview
  :src="url"
  type="auto"
  name="示例.mp4"
  color="#10b981"
  @load="onLoad"
  @error="onError"
  @timeupdate="onTime"
/>
```

```js
methods: {
  onLoad(e) { console.log(e.detail) }, // CustomEvent 载荷在 e.detail
  // 命令式 API：this.$refs.preview.play()
}
```

### 4. Vue3（两种方式）

**方式 A：直接使用自定义元素**（vite.config.ts 必须配置，SFC 预编译不读 app.config）：

```ts
import vue from '@vitejs/plugin-vue'
export default {
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('file-') } } })],
}
```

```vue
<file-preview :src="url" @zoom="fn" />
```

**方式 B：使用封装包 [`@allfile-preview/vue3`](https://www.npmjs.com/package/@allfile-preview/vue3)**（无需任何配置）：

```ts
import { FilePreview } from '@allfile-preview/vue3'
import '@allfile-preview/core' // 注册自定义元素（副作用）
```

```vue
<FilePreview src="a.png" @zoom="fn" />
```

### 5. React

使用封装包 [`@allfile-preview/react`](https://www.npmjs.com/package/@allfile-preview/react)：

```tsx
import { FilePreview } from '@allfile-preview/react'
import '@allfile-preview/core' // 注册自定义元素（副作用）

<FilePreview
  src="a.mp4"
  type="video"
  onError={(d) => console.log(d.message)}
  onTimeupdate={(d) => console.log(d.currentTime)}
  ref={elRef} // elRef.current.play() 调用命令式 API
/>
```

## 各类型预览详细说明

### 图片

```html
<file-preview src="/media/sample.svg" type="image" name="图片.svg"></file-preview>
```

- 支持 jpg / png / gif / webp / bmp / svg / avif / ico
- 交互：滚轮缩放（以光标为中心）、工具条缩放（以视口中心）、适应宽度、左右旋转、拖拽平移、重置
- 工具栏悬浮于预览区底部居中，所有按钮（含旋转/重置）尺寸统一
- `load` 事件 detail 含 `{ type: 'image', width, height }`（原始尺寸）

### 视频 / 音频

```html
<file-preview src="/media/tone.wav" type="audio" name="音频标题"></file-preview>
<file-preview src="/media/movie.mp4" type="video" poster="/cover.jpg" autoplay loop></file-preview>
```

- 视频：点击画面切换播放；音频：卡片式布局（poster 作封面，name 作标题）
- 自动播放受浏览器策略限制，开启 `autoplay` 时会强制静音
- `load` detail 含 `{ duration }`；`timeupdate` 约 250ms 节流派发一次
- 预览本地文件：`<input type="file">` 选文件后 `URL.createObjectURL(file)` 传入 `src`

#### 播放器控件配置

默认显示全部控件（快退/快进步长 10 秒），通过 `controls` 属性配置，支持两种形态：

**对象覆盖式**——与默认值合并，只改想改的项：

```html
<!-- 快退/快进步长改为 15 秒，隐藏全屏按钮 -->
<file-preview src="/media/movie.mp4" type="video" controls='{"skip":15,"fullscreen":false}'></file-preview>
```

**数组白名单**——只显示列出的控件：

```html
<!-- 极简播放器：只留进度条 -->
<file-preview src="/media/tone.wav" type="audio" controls='["progress"]'></file-preview>
```

| 键 | 类型 / 默认值 | 说明 |
|---|---|---|
| `skip` | number \| boolean / `10` | 快退/快进按钮：number = 步长秒数，`false` = 隐藏 |
| `rate` | boolean / `true` | 倍速按钮（0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x 循环切换） |
| `volume` | boolean / `true` | 音量按钮 + 音量条 |
| `loop` | boolean / `true` | 循环开关按钮 |
| `fullscreen` | boolean / `true` | 全屏按钮（仅视频有效，音频不渲染） |
| `progress` | boolean / `true` | 进度条 |

Vue2 中 `:controls` 绑定 JSON 字符串（与 `actions` 同理）；Vue3 / React 可直接传对象或数组。倍速切换派发 `ratechange`（`{ rate }`），进入/退出全屏派发 `fullscreenchange`（`{ fullscreen }`）。

### PDF

```html
<file-preview src="/files/report.pdf" type="pdf" c-map-url="/pdf/cmaps/"></file-preview>
```

- 底部页码栏（上一页 / 下一页 / 页码输入跳转）；右上角悬浮缩放条（缩小 / 放大 / 适应宽度，50% ~ 300%）
- `load` detail 含 `{ pages }`；`pagechange` detail 含 `{ page, pages }`
- 命令式：`goToPage(n)` `nextPage()` `prevPage()`
- 中文等非嵌入字体 PDF 需部署 cMaps 目录并设置 `cMapUrl`（见 [局域网部署](#局域网离线部署)）

### TXT

```html
<file-preview src="/files/readme.txt" type="text" name="说明.txt"></file-preview>
```

- 支持 txt / log / json / xml / csv / yaml / ini / sql / js / css / html / vue 等文本类扩展名
- 白色纸张风格内容区（深色正文 + 深灰行号，等宽字体），配色经 `--fv-doc-*` 变量组自定义，见 [CSS 变量](#css-变量)
- 右上角悬浮缩放条：缩小 / 放大 / 适应宽度（50% ~ 300%），缩放派发 `zoom` 事件；正文按容器宽度自动换行，适应宽度即恢复 100%
- 自动编码检测：严格 UTF-8 → GB18030 → Big5 → Latin-1 依次尝试（中文 Windows GBK 文件不乱码）
- `load` detail 含 `{ encoding }`（实际使用的编码）
- 超过 50 万字符自动截断并提示

### Markdown

```html
<file-preview src="/docs/api.md" type="markdown" name="接口文档.md"></file-preview>
```

- 支持 .md / .markdown 扩展名；GFM 语法（表格、任务列表、删除线）+ 换行即分段（breaks）
- 完整排版样式：标题层级、代码块、行内代码、表格（斑马纹）、引用块、链接、图片自适应宽度
- 白色纸张风格内容区（浅灰代码块/引用块/表头、浅灰分割线），配色经 `--fv-doc-*` 变量组自定义，见 [CSS 变量](#css-变量)
- 右上角悬浮缩放条：缩小 / 放大 / 适应宽度（50% ~ 300%），缩放派发 `zoom` 事件；适应宽度将正文排版宽度撑满容器（排版最大宽 860px）
- 自动编码检测与 TXT 一致；`load` detail 含 `{ encoding }`
- 超过 50 万字符自动截断并提示

> **安全注意**：marked 不做 HTML 白名单过滤（保留原始 HTML 能力）。请**仅用于渲染可信来源的 Markdown**；若内容来自用户输入等不可信渠道，请先自行 sanitize（如 DOMPurify）再传入。

### Word（.docx）

```html
<file-preview src="/files/合同.docx" type="docx" name="合同.docx"></file-preview>
```

- 标题 / 段落富文本（加粗、斜体、颜色）/ 列表 / 表格 / 分页 / 页眉页脚 / 脚注尾注
- 加载时自动"适应宽度"（页面比容器宽时按比例缩小）；右上角悬浮缩放条：缩小 / 放大 / 适应宽度（撑满可用宽度，50% ~ 300%）
- 中文字体（宋体/微软雅黑等）依赖查看者系统字体，无需服务器部署字体
- 仅支持 .docx；.doc 老二进制格式会显示友好错误提示（请先在 Word 中另存为 .docx）

### Excel（.xlsx / .xls）

```html
<file-preview src="/files/名单.xlsx" type="xlsx" name="名单.xlsx"></file-preview>
```

- SheetJS 本地解析，多工作表 tab 切换
- 白色纸张风格表格区（白底单元格、浅灰边框、浅灰行号列；tab 栏保持深色工具栏风格），配色经 `--fv-doc-*` 变量组自定义，见 [CSS 变量](#css-变量)
- 右上角悬浮缩放条：缩小 / 放大 / 适应宽度（50% ~ 300%），缩放派发 `zoom` 事件
- 合并单元格（rowspan / colspan）、列宽（wpx/wch）、数字右对齐、日期格式化（含时间自动带时分秒）
- 行号列滚动吸顶（sticky）；超过 2000 行截断并提示
- `load` detail 含 `{ sheets }`（工作表数量）
- 空工作表显示"当前工作表为空"提示

## 操作栏：下载与自定义操作

预览区上方可显示一条操作栏，包含**下载按钮**（`downloadable`，所有文件类型可用）与**自定义按钮**（`actions` 属性或 `slot="action"` 插槽）。三者任意存在即显示操作栏。

### 下载

```html
<file-preview src="/files/报告.pdf" name="报告.pdf" downloadable></file-preview>
```

- 点击下载按钮（或调用 `download()` 方法）即下载当前预览文件
- 下载文件名取 `name` 属性，缺省时取 URL 最后一段
- 实现：同源 / blob / data URL 直接保存；跨域 fetch 成功则转 blob 保存（保证触发下载而非跳转）；跨域被拒时回退为新标签打开原地址（`fallback: true`）
- 完成后派发 `download` 事件：detail `{ filename, src, fallback }`

### 自定义按钮（如删除）

`actions` 属性传 JSON 字符串（Vue2 setAttribute 兼容）或数组（Vue3/React property 直传），每项 `{ key, label, danger? }`：

```html
<file-preview
  src="/files/合同.pdf"
  name="合同.pdf"
  downloadable
  actions='[{"key":"delete","label":"删除","danger":true},{"key":"share","label":"分享"}]'
></file-preview>
```

点击按钮派发 `action` 事件，detail 携带 `key` 与**当前预览文件信息**，在回调里即可调用删除等业务接口：

```js
document.querySelector('file-preview').addEventListener('action', (e) => {
  const { key, src, name, type } = e.detail
  if (key === 'delete') {
    if (confirm(`确认删除「${name}」？`)) {
      // fetch('/api/delete', { method: 'POST', body: JSON.stringify({ src, name, type }) })
    }
  }
})
```

`danger: true` 的按钮渲染为红色描边（适合删除等危险操作）。也可用插槽塞任意自定义内容：

```html
<file-preview src="a.pdf">
  <button slot="action" class="my-btn">收藏</button>
</file-preview>
```

## 水印

`watermark` 属性为**所有预览类型**叠加平铺水印（图片 / 视频 / 音频 / PDF / TXT / Markdown / Word / Excel 均生效）。传入 JSON 字符串（Vue2 setAttribute 兼容）或对象直传（Vue3/React property）：

```html
<!-- 文字水印：fontSize 控制大小 -->
<file-preview
  src="/files/合同.pdf"
  watermark='{"text":"内部资料 · 禁止外传","fontSize":18,"gap":120}'
></file-preview>

<!-- 图片水印：width 控制大小（只给 width 时高度等比） -->
<file-preview
  src="/files/设计稿.png"
  watermark='{"image":"/logo.png","width":120,"gap":100,"opacity":0.4}'
></file-preview>
```

配置项（`text` 与 `image` 二选一，同时配置时 `image` 优先；两者都缺省则不显示水印）：

| 配置项 | 类型 / 默认值 | 说明 |
|---|---|---|
| `text` | string | 文字水印内容 |
| `image` | string | 图片水印地址（http / blob / data URL；跨域图片需服务端允许 CORS，否则不显示） |
| `width` | number / 自适应 | 单个水印宽度 px；缺省时文字按内容自适应、图片按原始宽度 |
| `height` | number / 自适应 | 单个水印高度 px；缺省时文字按字号自适应、图片按 `width` 等比缩放 |
| `fontSize` | number / `16` | 文字大小 px（仅文字水印生效） |
| `color` | string / `'#94a3b8'` | 文字颜色（默认中性灰，深浅背景均可见） |
| `opacity` | number / `0.35` | 整体透明度 0~1（文字与图片均生效） |
| `rotate` | number / `-22` | 旋转角度（单位度，顺时针为正） |
| `gap` | number / `100` | 相邻水印间距 px |

实现方式：canvas 按配置绘制单个水印（含旋转包围盒）生成平铺图案，以 `background-repeat` 覆盖整个预览区，覆盖层 `pointer-events: none` 不影响缩放、拖拽、滚动等交互。注意水印为展示层防护，未做防篡改（用户可通过开发者工具移除），需要强防护的场景请在服务端处理。

## API

### `<file-preview>` 属性

| 属性 | 类型/默认值 | 说明 |
|---|---|---|
| `src` | string / `''` | 文件地址（http / blob / data URL） |
| `type` | `'image' \| 'video' \| 'audio' \| 'pdf' \| 'text' \| 'markdown' \| 'docx' \| 'xlsx' \| 'auto'` / `auto` | auto 时自动检测 |
| `name` | string / `''` | 文件名（扩展名参与检测；audio/markdown 模式下作标题） |
| `mime` | string / `''` | MIME 提示（如 `image/png`） |
| `poster` | string / `''` | 视频/音频封面 |
| `autoplay` | boolean / false | 自动播放（浏览器策略会强制静音） |
| `muted` | boolean / false | 静音 |
| `loop` | boolean / false | 循环 |
| `preload` | string / `'metadata'` | 预加载策略 |
| `crossorigin` | string / `''` | CORS 属性 |
| `color` | string / `''` | 主题色 |
| `cMapUrl` | string / `''` | pdfjs cMaps 目录地址（结尾带斜杠，如 `/pdf/cmaps/`），中文等非嵌入字体 PDF 需要，见 [局域网部署](#局域网离线部署) |
| `downloadable` | boolean / false | 操作栏显示下载按钮，见 [操作栏](#操作栏下载与自定义操作) |
| `actions` | string / array / `''` | 操作栏自定义按钮（JSON 字符串或数组），每项 `{ key, label, danger? }`，见 [操作栏](#操作栏下载与自定义操作) |
| `controls` | string / object / array / `''` | 播放器控件配置，仅 video / audio 生效（对象覆盖式或数组白名单），见 [播放器控件配置](#播放器控件配置) |
| `watermark` | string / object / `''` | 水印配置（所有预览类型生效）：`{ text, image, width, height, fontSize, color, opacity, rotate, gap }`，text 与 image 二选一，见 [水印](#水印) |

### 事件（CustomEvent，bubbles + composed，载荷在 `e.detail`）

| 事件 | detail | 说明 |
|---|---|---|
| `load` | `{type, width?, height?, duration?, pages?, encoding?, sheets?}` | 元数据就绪（pdf 含页数、txt/markdown 含编码、xlsx 含工作表数） |
| `error` | `{code: 'load-failed' \| 'unsupported-type', message}` | 加载失败/类型不支持 |
| `zoom` / `rotate` / `reset` | `{scale}` / `{angle}` / `{}` | 图片 / pdf / docx / xlsx 视图变化 |
| `play` / `pause` / `ended` | `{type}` | 播放状态 |
| `timeupdate` | `{currentTime, duration}` | 播放进度（约 250ms 节流） |
| `seek` | `{time}` | 用户主动跳转 |
| `volumechange` | `{volume, muted}` | 音量/静音变化 |
| `ratechange` | `{rate}` | 倍速切换（0.5x ~ 2x 循环） |
| `fullscreenchange` | `{fullscreen}` | 进入/退出全屏（仅视频） |
| `pagechange` | `{page, pages}` | PDF 翻页 |
| `download` | `{filename, src, fallback}` | 触发下载（fallback=true 表示跨域 fetch 失败已回退为新标签打开原地址） |
| `action` | `{key, src, name, type}` | 用户点击 `actions` 配置的自定义按钮（如删除），可在此回调中调用业务接口 |

### 命令式方法（元素实例上直接调用）

- 图片：`reset()` `zoomTo(scale)` `zoomBy(factor)` `fitWidth()` `rotateTo(angle)` `rotateBy(delta)`
- 播放：`play()` `pause()` `seek(time)` `setVolume(v)` `skip(delta)`（相对快退/快进，如 `skip(-15)`）`setRate(rate)`（0.25 ~ 4）
- PDF：`goToPage(n)` `nextPage()` `prevPage()`
- 文档缩放（TXT / Markdown / XLSX）：`zoomBy(factor)` `fitWidth()`
- 下载：`download()`（与 downloadable 按钮等价）
- 通用：`getMediaElement()` `reload()`

### 类型自动检测规则

优先级从高到低：显式 `type` 属性 > `mime` 属性 > `name` 文件名扩展名 > URL 路径扩展名 > `data:` URL 内嵌 mime > HEAD 请求读 `Content-Type`（异步兜底，跨域被拒时静默失败）。全部失败则报 `unsupported-type` 错误，此时请显式传 `type`。

## 样式定制

### CSS 变量

```css
file-preview {
  /* 主题色：按钮激活态、进度条、tab 下划线、链接色等 */
  --fv-primary: #3b82f6;

  /* 预览舞台背景：图片/播放器/PDF/Word 的主内容区统一背景
     （覆盖一个变量即可给这些类型的预览换底色） */
  --fv-stage: #0f172a;

  /* 文档类浅色主题：TXT / Markdown / Excel 内容区为白色纸张风格
     （正文深色文字、浅灰边框与表头、浅灰代码块/引用块，整体可自定义） */
  --fv-doc-bg: #ffffff;        /* 文档内容区背景 */
  --fv-doc-text: #111827;      /* 文档正文文字 */
  --fv-doc-text-dim: #64748b;  /* 文档次要文字（行号、行号列、删除线等） */
  --fv-doc-border: #e2e8f0;    /* 文档边框（表格线、标题分割线、代码块描边） */
  --fv-doc-surface: #f1f5f9;   /* 文档浅灰块（表头、斑马纹、代码块、引用块背景） */

  /* 组件外围背景（错误态遮罩等） */
  --fv-bg: #0f172a;

  /* 工具栏/表面元素背景（meta 栏、sheet 标签栏、音频封面等） */
  --fv-surface: #1e293b;

  /* 次级表面（按钮 hover、行内代码、标签圆角块等） */
  --fv-surface-2: rgba(255, 255, 255, 0.1);

  --fv-text: #f1f5f9;        /* 主文字色 */
  --fv-text-dim: #94a3b8;    /* 次级文字色 */
  --fv-radius: 10px;         /* 圆角 */
  --fv-error: #ef4444;       /* 错误色 */
}
```

浅色主题示例（所有类型统一生效）：

```css
file-preview {
  --fv-stage: #f8fafc;
  --fv-bg: #f1f5f9;
  --fv-surface: #e2e8f0;
  --fv-surface-2: rgba(15, 23, 42, 0.08);
  --fv-text: #1e293b;
  --fv-text-dim: #64748b;
}
```

也可用 `color` 属性只改主题色：`<file-preview color="#10b981" ...>`。

TXT / Markdown / Excel 三类内容区默认已是白色纸张风格（独立于 `--fv-stage`），如需调整底色或文字配色，覆盖 `--fv-doc-*` 变量组即可（见上方变量表）。

### ::part 钩子

```css
file-preview::part(action-bar) { /* 操作栏（下载 / 自定义按钮容器） */ }
file-preview::part(toolbar) { /* 各类型工具栏 */ }
file-preview::part(zoom-bar) { /* pdf / docx / xlsx 悬浮缩放条（右上角） */ }
file-preview::part(watermark) { /* 水印覆盖层（所有预览类型） */ }
file-preview::part(media) { /* 媒体/文档主体区域 */ }
file-preview::part(progress) { /* 播放器进度条填充 */ }
file-preview::part(error-box) { /* 错误容器 */ }
```

### 自定义加载/错误/空态插槽

```html
<file-preview src="a.png">
  <div slot="loading">加载中…</div>
  <div slot="error">加载失败了</div>
  <div slot="empty">请选择文件</div>
</file-preview>
```

## 错误处理与排查

所有错误都会通过 `error` 事件抛出（`{ code, message }`），组件内同时渲染友好的中文错误态（可用 `slot="error"` 覆盖）。

| 场景 | 表现 / 错误信息 | 解决方式 |
|---|---|---|
| 地址错误 / 断网 / CORS 被拒 | "网络请求失败（地址错误 / 网络不可用 / 服务器未允许跨域访问）" | 检查 URL、网络、服务端 `Access-Control-Allow-Origin` |
| 资源不存在 | "HTTP 404 Not Found"（含具体状态码） | 检查文件路径 |
| `file://` 协议直接打开页面 | "file:// 协议下浏览器禁止读取本地文件…" | 用 http(s) 静态服务访问，或 `<input type="file">` 转 blob URL |
| PDF 已加密 | "PDF 文件已加密，暂不支持预览带密码的 PDF" | 解密后重新导出 |
| Excel 已加密 | "表格文件已加密，暂不支持预览带密码的 Excel" | 去除密码后另存 |
| .doc 老格式 | "文件解析失败：可能不是有效的 .docx 文件…" | Word 中另存为 .docx |
| 空工作表 | 界面提示"当前工作表为空"（非错误） | 正常现象，可切换其他 sheet |
| 无法识别类型 | `unsupported-type`："无法识别文件类型…" | 显式传 `type` 属性 |
| 大文件 | TXT/Markdown 超 50 万字符、Excel 超 2000 行自动截断并提示 | 正常保护机制 |

## 局域网（离线）部署

所有解析库（pdf.js / docx-preview / SheetJS / marked / Lit）全部打包进产物，**运行时零外部请求**（唯一例外见下方 cMaps）。推荐两种方式：

### 方式一：UMD 单文件（免构建工具链）

```html
<!-- 1. 把 node_modules/@allfile-preview/core/dist/allfile-preview.umd.cjs 复制到任意静态服务器 -->
<!-- 2. 页面里一个 script 引入即可，八类文件全部可预览 -->
<script src="/assets/allfile-preview.umd.cjs"></script>
<file-preview src="/files/报告.pdf" c-map-url="/assets/cmaps/"></file-preview>
```

简单静态服务示例（内网机器均可访问）：

```bash
# Python
python -m http.server 8080 --bind 0.0.0.0
# 或 Node
npx serve -l 8080 .
```

### 方式二：npm 包（ESM，配合 Vite/Webpack 等）

```bash
npm install @allfile-preview/core
```

```ts
import '@allfile-preview/core' // 注册所有自定义元素
```

### cMaps 目录（仅中文 PDF 需要）

非嵌入字体的中文 PDF 需要 pdf.js 的 cMap 文件（按需 fetch 的小文本文件）。将 `node_modules/pdfjs-dist/cmaps` 整个目录部署为静态资源，并设置 `cMapUrl` 属性：

```html
<file-preview src="中文文档.pdf" c-map-url="/assets/cmaps/"></file-preview>
```

不设置时嵌入字体的 PDF（绝大多数正式文档）仍可正常预览。

### 其他说明

- docx 中文字体（宋体/微软雅黑等）依赖**查看者系统字体**，无需服务器部署字体文件
- `file://` 协议直接双击打开 UMD 页面时，浏览器禁止 fetch 本地路径——可通过 `<input type="file">` 选择本机文件转 blob URL 预览，或用静态服务器走 http

## 已知限制

- 旋转后滚轮缩放中心为近似值
- 画中画、字幕未实现（结构已预留）
- 水印为展示层防护（未做防篡改）；跨域水印图片需服务端允许 CORS，否则不显示；视频进入全屏时水印不跟随（全屏作用于播放器内部元素）
- 无扩展名且跨域（HEAD 被拒）的 URL 无法自动检测类型，需显式传 `type`
- `.doc` / `.ppt` / `.pptx` 等老格式或未支持的格式会进入错误态；`.doc` 请先另存为 `.docx`
- 加密 PDF / Excel 暂不支持（显示明确提示）
- Markdown 不做 HTML 白名单过滤，不可信内容请先 sanitize
- PDF 双页/缩略图目录、docx 批注/修订、xlsx 公式计算结果为缓存值（SheetJS 读缓存）未做特殊处理

## 相关包

- [`@allfile-preview/vue3`](https://www.npmjs.com/package/@allfile-preview/vue3)：Vue3 封装（组件化 props/emits，无需配置 isCustomElement）
- [`@allfile-preview/react`](https://www.npmjs.com/package/@allfile-preview/react)：React 封装（事件桥接，支持 React 16.8+）

## License

MIT
