<template>
  <div id="app">
    <h1>file-preview · Vue2 接入</h1>
    <p class="desc">
      在 main.js 中配置 <code>Vue.config.ignoredElements = [/^file-/]</code>
      后，模板里直接使用 <code>&lt;file-preview&gt;</code>，属性用 <code>:src</code> 绑定、事件用 <code>@load</code> 监听。
    </p>

    <!-- 图片 -->
    <section class="section">
      <div class="section-title">图片预览</div>
      <div class="section-sub">滚轮缩放（以光标为中心）/ 拖拽 / 旋转 / 重置；downloadable 开启下载按钮；下方按钮演示响应式切换 src</div>
      <div class="toolbar">
        <button @click="imgSrc = MEDIA.image.local">本地 SVG</button>
        <button @click="imgSrc = MEDIA.image.remote">远程图片</button>
        <button @click="imgSrc = MEDIA.image.broken">404（错误态）</button>
        <button @click="callImageApi">调用 zoomTo(2) / rotateBy(90)</button>
      </div>
      <file-preview
        ref="imgPreview"
        class="preview"
        :src="imgSrc"
        type="image"
        name="示例图片.svg"
        downloadable
        watermark='{"text":"file-preview · 内部资料","fontSize":20,"gap":160}'
        @load="onEvent('load', $event)"
        @error="onEvent('error', $event)"
        @zoom="onEvent('zoom', $event)"
        @rotate="onEvent('rotate', $event)"
        @reset="onEvent('reset', $event)"
        @download="onEvent('download', $event)"
      ></file-preview>
    </section>

    <!-- 视频 -->
    <section class="section">
      <div class="section-title">视频预览</div>
      <div class="section-sub">自定义控件：播放/暂停、快退/快进（controls 配置步长，本例 15 秒）、进度拖拽、音量、倍速、循环、全屏</div>
      <div class="toolbar">
        <button @click="videoSrc = MEDIA.video.remote">远程 MP4</button>
        <button @click="videoSrc = MEDIA.video.broken">404（错误态）</button>
        <button @click="videoControls = VIDEO_CONTROLS_FULL">完整控件</button>
        <button @click="videoControls = VIDEO_CONTROLS_MINI">极简控件</button>
      </div>
      <file-preview
        ref="videoPreview"
        class="preview"
        :src="videoSrc"
        type="video"
        name="Big Buck Bunny.mp4"
        downloadable
        :controls="videoControls"
        @load="onEvent('load', $event)"
        @error="onEvent('error', $event)"
        @play="onEvent('play', $event)"
        @pause="onEvent('pause', $event)"
        @seek="onEvent('seek', $event)"
        @ratechange="onEvent('ratechange', $event)"
        @download="onEvent('download', $event)"
      ></file-preview>
    </section>

    <!-- 音频 -->
    <section class="section">
      <div class="section-title">音频预览</div>
      <div class="section-sub">卡片式播放器 + color 属性换主题色；controls 配置快退/快进步长为 5 秒</div>
      <div class="toolbar">
        <button @click="audioSrc = MEDIA.audio.local">本地 WAV</button>
        <button @click="audioSrc = MEDIA.audio.remote">远程 MP3</button>
      </div>
      <file-preview
        class="preview"
        :src="audioSrc"
        type="audio"
        :name="audioName"
        color="#10b981"
        downloadable
        :controls="AUDIO_CONTROLS"
        @load="onEvent('load', $event)"
        @play="onEvent('play', $event)"
        @volumechange="onEvent('volumechange', $event)"
        @ratechange="onEvent('ratechange', $event)"
        @download="onEvent('download', $event)"
      ></file-preview>
    </section>

    <!-- 文档：PDF / 文本 / Word / Excel -->
    <section class="section">
      <div class="section-title">文档预览（PDF / TXT / Markdown / Word / Excel）</div>
      <div class="section-sub">全部本地解析（pdf.js / marked / docx-preview / SheetJS），无外部请求，局域网可用；支持选择本机文件</div>
      <div class="toolbar">
        <button @click="setDoc('pdf')">PDF</button>
        <button @click="setDoc('text')">TXT</button>
        <button @click="setDoc('markdown')">MD</button>
        <button @click="setDoc('docx')">DOCX</button>
        <button @click="setDoc('xlsx')">XLSX</button>
        <button @click="setDoc('broken')">404（错误态）</button>
        <label class="file-label">选择本地文件…<input type="file" hidden accept=".pdf,.txt,.log,.md,.json,.csv,.docx,.xlsx" @change="onLocalFile" /></label>
        <button @click="callPdfApi">PDF goToPage(2)</button>
        <button @click="setWm('text')">文字水印</button>
        <button @click="setWm('image')">图片水印</button>
        <button @click="setWm('off')">关闭水印</button>
      </div>
      <file-preview
        ref="docPreview"
        class="preview"
        :src="docSrc"
        :type="docType"
        :name="docName"
        :c-map-url="MEDIA.pdf.cMapUrl"
        downloadable
        :actions="DOC_ACTIONS"
        :watermark="docWatermark"
        @load="onEvent('load', $event)"
        @error="onEvent('error', $event)"
        @pagechange="onEvent('pagechange', $event)"
        @zoom="onEvent('zoom', $event)"
        @download="onEvent('download', $event)"
        @action="onDocAction"
      ></file-preview>
    </section>

    <div class="log">事件日志：{{ logs.join('\n') }}</div>
  </div>
</template>

<script>
import { MEDIA } from '../../shared/media'

const DOC_MAP = {
  pdf: { src: MEDIA.pdf.local, type: 'pdf', name: 'sample.pdf' },
  text: { src: MEDIA.text.local, type: 'text', name: 'sample.txt' },
  markdown: { src: MEDIA.markdown.local, type: 'markdown', name: 'sample.md' },
  docx: { src: MEDIA.docx.local, type: 'docx', name: 'sample.docx' },
  xlsx: { src: MEDIA.xlsx.local, type: 'xlsx', name: 'sample.xlsx' },
  broken: { src: 'media/not-exist.pdf', type: 'pdf', name: 'not-exist.pdf' }
}

// 操作栏自定义按钮（JSON 字符串，Vue2 setAttribute 兼容）
const DOC_ACTIONS = JSON.stringify([
  { key: 'delete', label: '删除', danger: true },
  { key: 'share', label: '分享' }
])

// 播放器控件配置（JSON 字符串，Vue2 setAttribute 兼容）
// 对象 = 覆盖默认值；数组 = 白名单（只保留所列控件）
const VIDEO_CONTROLS_FULL = JSON.stringify({ skip: 15 }) // 快退/快进 15 秒，其余默认
const VIDEO_CONTROLS_MINI = JSON.stringify(['progress']) // 白名单：只留进度条
const AUDIO_CONTROLS = JSON.stringify({ skip: 5 }) // 音频快退/快进 5 秒

export default {
  name: 'App',
  data() {
    return {
      MEDIA,
      DOC_ACTIONS,
      VIDEO_CONTROLS_FULL,
      VIDEO_CONTROLS_MINI,
      AUDIO_CONTROLS,
      videoControls: VIDEO_CONTROLS_FULL,
      imgSrc: MEDIA.image.local,
      videoSrc: MEDIA.video.remote,
      audioSrc: MEDIA.audio.local,
      docSrc: MEDIA.pdf.local,
      docType: 'pdf',
      docName: 'sample.pdf',
      docWatermark: '',
      logs: ['（等待事件…）']
    }
  },
  computed: {
    audioName() {
      return this.audioSrc === MEDIA.audio.local ? 'C 大调琶音 · tone.wav' : 'SoundHelix Song 1 · mp3'
    }
  },
  methods: {
    onEvent(name, e) {
      // e 为原生事件对象，自定义元素事件为 CustomEvent，载荷在 e.detail
      const detail = e && e.detail !== undefined ? ' ' + JSON.stringify(e.detail) : ''
      const line = `[${name}]${detail}`
      this.logs = [...this.logs.slice(-30), line]
    },
    // 通过 ref 调用组件命令式 API（自定义元素方法直接可用）
    callImageApi() {
      const el = this.$refs.imgPreview
      el.zoomTo(2)
      el.rotateBy(90)
    },
    setDoc(key) {
      const item = DOC_MAP[key]
      this.docType = item.type
      this.docName = item.name
      this.docSrc = item.src
    },
    // 操作栏自定义按钮：action 事件 → 取文件信息调用业务接口
    onDocAction(e) {
      const detail = e.detail // { key, src, name, type }
      this.logs = [...this.logs.slice(-30), `[action] ${JSON.stringify(detail)}`]
      if (detail.key === 'delete') {
        // 这里拿 detail.src / detail.name / detail.type 调用删除接口
        if (window.confirm(`确认删除「${detail.name}」？（demo 模拟接口调用）`)) {
          console.log('[模拟删除接口] payload =', detail)
          this.logs = [...this.logs.slice(-30), `[delete] 已调用删除接口（模拟）：${detail.name}`]
        }
      }
    },
    // 本地文件：blob URL + 文件名扩展名检测
    onLocalFile(e) {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      this.docType = 'auto'
      this.docName = file.name
      this.docSrc = URL.createObjectURL(file)
    },
    callPdfApi() {
      this.$refs.docPreview.goToPage(2)
    },
    // 水印切换（watermark 属性：文字 / 图片，大小与间距可配置）
    setWm(kind) {
      const map = {
        text: { text: '内部资料 · 禁止外传', fontSize: 18, gap: 120 },
        image: { image: 'media/sample.svg', width: 120, gap: 100, opacity: 0.4 }
      }
      this.docWatermark = kind === 'off' ? '' : JSON.stringify(map[kind])
    }
  }
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #020617;
  color: #e2e8f0;
  padding: 24px;
}
h1 { font-size: 22px; margin-bottom: 6px; }
.desc { color: #64748b; font-size: 13px; margin-bottom: 20px; }
.desc code, .section-sub code { background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #93c5fd; }
.section { margin-bottom: 28px; }
.section-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.section-sub { color: #64748b; font-size: 12px; margin-bottom: 10px; }
.preview { width: 100%; height: 420px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.toolbar button {
  padding: 6px 14px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.toolbar button:hover { border-color: #3b82f6; background: #1e293b; }
.toolbar .file-label {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.toolbar .file-label:hover { border-color: #3b82f6; background: #1e293b; }
.log {
  margin-top: 10px;
  padding: 10px 12px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  font-family: Consolas, monospace;
  font-size: 12px;
  color: #94a3b8;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
