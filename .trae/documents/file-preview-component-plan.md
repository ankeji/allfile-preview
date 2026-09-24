# 跨框架文件预览组件 — 实施计划

## Context（背景）

在空项目 `d:\other\file-view` 中从零实现一套**文件预览组件**，要求同一套组件可在**原生 HTML、Vue2、Vue3、React** 四种环境中使用。第一期实现三类媒体的预览：

- **图片**：自适应展示 + 滚轮/按钮缩放（以光标为中心）+ 旋转 + 拖拽平移 + 重置（用户已确认）
- **视频 / 音频**：自定义统一风格播放器 UI（播放/暂停、可拖拽进度条、音量、静音、循环、时间显示、加载/错误态），不使用浏览器原生 controls（用户已确认）

环境约束：Windows + Node v16.15.0（**不能用 Vite 5+**）+ npm 8.5.5（支持 workspaces，无 pnpm）。

## 核心架构决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 跨框架方案 | **Web Components（Lit 2.8）** | 唯一能一次开发、四端原生运行的方案；Lit 2.x 与 Node16 工具链无兼容风险 |
| Monorepo | **npm workspaces** | npm 8.5 原生支持，无需额外工具 |
| React 支持 | **@file-view/react 薄封装** | React ≤18 无法声明式绑定自定义元素事件，需 ref + addEventListener 桥接 |
| Vue2/Vue3 | 直接用自定义元素 + 少量配置 | Vue2: `ignoredElements`；Vue3: vite 插件层 `isCustomElement`。事件 `@xx` 均可用 |
| 属性设计 | **全部 string/number/boolean** | Vue2 对自定义元素只能 setAttribute，禁止对象/数组属性（硬约束） |
| 构建产物 | core 双构建：ESM（external lit）+ UMD（内联 lit，全局变量 `FilePreview`） | Vite 4 lib mode 无法按 format 区分 external，需 `--mode esm` / `--mode umd` 两次构建 |
| Demo 运行方式 | vite alias 直接指向 core 源码 | dev 无需预构建 dist |

## 目录结构

```
d:\other\file-view\
├── package.json                  # workspaces: packages/*, demos/*；构建工具集中于此
├── .npmrc                        # 默认 npmmirror 镜像（网络备用）
├── .gitignore                    # node_modules / dist / demos/*/public/media
├── tsconfig.base.json
├── packages/
│   ├── core/                     # @file-view/core（Lit Web Components）
│   │   ├── package.json          # lit 为 dependencies；sideEffects 保住组件注册副作用
│   │   ├── tsconfig.json         # experimentalDecorators + useDefineForClassFields:false（Lit 2 硬性要求）
│   │   ├── vite.config.ts        # 双 mode 构建
│   │   └── src/
│   │       ├── index.ts          # 导出组件类 + 副作用注册 customElements
│   │       ├── types.ts / constants.ts / detect.ts
│   │       ├── utils/            # format-time / clamp / dispatch(事件派发)
│   │       ├── styles/theme.ts   # CSS 变量默认值 + 按钮滑块基础样式
│   │       └── components/
│   │           ├── file-preview.ts              # <file-preview> 主组件：检测+分发
│   │           ├── file-preview-image.ts        # 图片查看器
│   │           ├── file-preview-video.ts        # 视频（复用 player）
│   │           ├── file-preview-audio.ts        # 音频（封面区 + player）
│   │           └── media/
│   │               ├── file-preview-player.ts   # 统一播放器控件
│   │               └── fv-slider.ts             # 通用滑块（进度/音量共用）
│   └── react/                    # @file-view/react（forwardRef 封装）
│       └── src/FilePreview.tsx   # 属性白名单透传 + 事件桥接
├── demos/
│   ├── shared/                   # 无 package.json（不进 workspace）
│   │   ├── media.ts              # 示例媒体 URL 常量
│   │   └── gen-media.mjs         # 零依赖脚本：生成正弦波测试 WAV
│   ├── vanilla/                  # 含 index.html(dev) + umd-standalone.html(file:// 直开验证)
│   ├── vue2-demo/                # Vue 2.7.16 + @vitejs/plugin-vue2
│   ├── vue3-demo/                # Vue 3.4 + @vitejs/plugin-vue 4.x
│   └── react-demo/               # React 18 + @vitejs/plugin-react 4.x
└── README.md                     # 最后写：四环境接入文档
```

## 组件 API 设计

### `<file-preview>` 属性（attribute 可设）

`src`(必填) / `type`(`'image'|'video'|'audio'|'auto'`，默认 auto 自动检测) / `name`(文件名，audio 模式下作标题) / `mime`(MIME 提示) / `poster`(封面) / `autoplay` / `muted` / `loop` / `preload`(默认 metadata) / `crossorigin` / `color`(主题色，映射 `--fv-primary`)

### 事件（CustomEvent，bubbles + composed）

`load` `{type,width?,height?,duration?}` / `error` `{code:'load-failed'|'unsupported-type',message}` / `zoom` `{scale}` / `rotate` `{angle}` / `reset` / `play` / `pause` / `ended` / `timeupdate` `{currentTime,duration}`(节流 250ms) / `seek` `{time}` / `volumechange` `{volume,muted}`

### 命令式方法

图片：`reset() / zoomTo(s) / zoomBy(d) / rotateTo(a) / rotateBy(d)`；播放：`play() / pause() / seek(t) / setVolume(v)`；通用：`getMediaElement() / reload()`

### CSS 定制

CSS 变量：`--fv-primary`(默认 #3b82f6) `--fv-bg` `--fv-surface` `--fv-text` `--fv-radius`；`::part(toolbar|control-button|progress|volume|time-label|error-box)`；slot：`loading` / `error` / `empty`

### 类型自动检测优先级

显式 `type` > `mime` 属性前缀 > 扩展名（`name` 的扩展名优先于 URL 的；`new URL()` 剥离 query）> HEAD 请求读 Content-Type（跨域静默失败）> 报 `unsupported-type` 错误。`.ogg` 歧义归 audio。

## 关键实现要点

1. **core 双 mode 构建**：`umd` mode → formats umd、lit 内联、target es2018、产物 `file-view.umd.cjs`；`esm` mode → formats es、external `/^lit/`、产物 `index.js`。类型声明用 `tsc --emitDeclarationOnly`
2. **Lit + TS 陷阱**：`experimentalDecorators: true` + `useDefineForClassFields: false` + `target: ES2021`（否则 @property 响应式失效）
3. **图片查看器**：状态机 `{x,y,scale,rotate}` → `transform: translate() scale() rotate()`；fitScale 由 ResizeObserver + naturalWidth/Height 计算；**滚轮必须 `{passive:false}` + preventDefault**；zoom-to-cursor 公式 `newX = cursorX - (cursorX - x) * (newScale/oldScale)`；缩放钳制 [0.2, 8]；Pointer Events 拖拽（setPointerCapture）；右上角工具栏（放大/缩小/左旋/右旋/重置/百分比）
4. **播放器**：`<fv-slider>` 通用滑块（Pointer Events + setPointerCapture，进度/音量共用）；**拖动进度条时置 dragging 标志仅更新 UI，pointerup 才写 currentTime**（防抖动）；静音记忆 lastVolume；时间格式 `<1h → m:ss`，`≥1h → h:mm:ss`；媒体事件桥接（loadedmetadata/timeupdate/play/pause/ended/waiting/error）；autoplay 自动 muted（浏览器策略）；按钮用原生 `<button>` + aria-label，滑块 role="slider"
5. **React 桥接**：forwardRef + useEffect 内 addEventListener（回调经 ref 存最新闭包防 stale closure）；属性白名单逐一以 DOM property 赋值；Props：`onLoad/onError/onZoom/onRotate/onPlay/onPause/onEnded/onTimeupdate/onVolumechange`
6. **Vue2 接入**：`Vue.config.ignoredElements = [/^file-/]`；v-on 编译为 addEventListener 可用；布尔属性语义与 Lit Boolean 转换器兼容
7. **Vue3 接入**：`isCustomElement` 必须配在 **vite.config 的 vue 插件层**（`app.config.compilerOptions` 只对运行时编译生效，SFC 预编译不走它），两处都写、以 vite 为准
8. **示例媒体（不引入二进制文件）**：图片用仓库内手写 SVG + 远程 URL；音频用 `gen:media` 脚本生成 WAV（gitignore 生成物）+ SoundHelix 远程 MP3；视频用 Google 公开样例桶 BigBuckBunny.mp4；`demos/shared/media.ts` 统一导出常量

## 依赖版本（Node 16 兼容核对）

vite ^4.5.3 / typescript ~5.0.4 / lit ^2.8.0 / vue2-demo: vue ^2.7.16 + @vitejs/plugin-vue2 ^2.3.1 / vue3-demo: vue ^3.4.38 + @vitejs/plugin-vue ^4.6.2 / react-demo: react(-dom) ^18.3.1 + @vitejs/plugin-react ^4.3.4。双 vue 大版本共存由 npm 嵌套安装解决（预期 hoist 警告，不影响运行）。

## 实施步骤

1. **Monorepo 脚手架**：根配置文件 + 目录骨架 + git init + `npm install`（失败则切镜像）
2. **core 骨架 + 构建链路**：types/constants/detect + 主组件（先分发简版 image）+ 双 mode 构建 + vanilla demo 起步；门禁：三产物（index.js / file-view.umd.cjs / index.d.ts）生成，vanilla dev 显示图片
3. **图片查看器完整功能**：交互状态机 + 工具栏 + 事件 + 加载/错误态
4. **fv-slider → player → audio 组件**：主组件分发接入
5. **video 组件**：复用 player + poster + 点击画面播放/暂停
6. **@file-view/react 封装 + react demo**
7. **vue2 / vue3 demo + umd-standalone.html + README**

## 验证方式

- **产物**：`npm run build` 后 core 三产物存在；`node -e "require('./packages/core/dist/file-view.umd.cjs')"` CJS 环境可加载
- **UMD 脱离工具链**：双击 `demos/vanilla/umd-standalone.html`（file:// 协议）三种媒体可交互
- **四 demo 统一 checklist**（每环境 `npm run dev` 后逐项验证）：①三类型渲染 ②切换 src/type 响应（含 blob URL）③事件绑定打印（vanilla addEventListener / Vue @error / React onError）④404 URL → 错误 UI + error 事件 ⑤图片缩放/拖拽/旋转/重置 ⑥播放器全控件操作 ⑦框架特有：Vue2 无 Unknown custom element 警告、Vue3 SFC 无编译警告、React 事件桥接生效
- **workspace 软链**：`npm ls @file-view/core` 四 demo 均指向本地包
