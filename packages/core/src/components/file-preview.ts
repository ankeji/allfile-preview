import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { detectType, detectTypeByHead } from '../detect'
import { emit } from '../utils/dispatch'
import { themeStyles } from '../styles/theme'
import type {
  FvActionDetail,
  FvActionItem,
  FvDownloadDetail,
  FvErrorDetail,
  FvPlayerControls,
  FvWatermarkOptions,
  MediaType,
  TypeAttr
} from '../types'
import { buildWatermarkTile, type WatermarkTile } from '../utils/watermark'
import type { FilePreviewImage } from './file-preview-image'
import type { FilePreviewVideo } from './file-preview-video'
import type { FilePreviewAudio } from './file-preview-audio'
import type { FilePreviewPdf } from './file-preview-pdf'
import type { FilePreviewText } from './file-preview-text'
import type { FilePreviewMarkdown } from './file-preview-markdown'
import type { FilePreviewDocx } from './file-preview-docx'
import type { FilePreviewXlsx } from './file-preview-xlsx'
import './file-preview-image'
import './file-preview-video'
import './file-preview-audio'
import './file-preview-pdf'
import './file-preview-text'
import './file-preview-markdown'
import './file-preview-docx'
import './file-preview-xlsx'

const ICON_EMPTY = html`<svg class="fv-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>`
const ICON_WARN = html`<svg class="fv-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>`
const ICON_DOWNLOAD = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>`

/**
 * <file-preview> 文件预览主组件（对外唯一入口）
 *
 * 根据 type 属性（或自动检测：扩展名 / MIME / HEAD 请求）分发到
 * 图片查看器 / 视频播放器 / 音频播放器 / PDF / 文本 / Markdown / Word(docx) / Excel(xlsx) 预览器。
 *
 * 属性：src / type / name / mime / poster / autoplay / muted / loop / preload / crossorigin / color / cMapUrl / downloadable / actions / controls / watermark
 * 事件（bubbles + composed）：load / error / zoom / rotate / reset / play / pause / ended / timeupdate / seek / volumechange / ratechange / fullscreenchange / pagechange / download / action
 */
@customElement('file-preview')
export class FilePreview extends LitElement {
  /** 文件地址（http / blob / data URL 均可） */
  @property() src = ''

  /** 媒体类型：image | video | audio；默认 auto 自动检测 */
  @property() type: TypeAttr = 'auto'

  /** 文件名（扩展名优先作为检测依据；audio 模式下作为标题展示） */
  @property() name = ''

  /** MIME 提示（如 image/png），优先级高于扩展名 */
  @property() mime = ''

  /** 视频 / 音频封面 */
  @property() poster = ''

  /** 自动播放（浏览器策略要求：自动播放时会强制静音） */
  @property({ type: Boolean }) autoplay = false

  /** 静音 */
  @property({ type: Boolean }) muted = false

  /** 循环播放 */
  @property({ type: Boolean }) loop = false

  /** 预加载策略：none | metadata | auto（默认 metadata） */
  @property() preload = 'metadata'

  /** CORS 属性：anonymous | use-credentials */
  @property() crossorigin = ''

  /** 主题色（等价于设置 --fv-primary 变量） */
  @property() color = ''

  /** pdfjs cMaps 目录地址（如 /pdf/cmaps/，结尾带斜杠），中文等非嵌入字体 PDF 需要 */
  @property() cMapUrl = ''

  /** 显示下载按钮（操作栏），点击触发下载并派发 download 事件 */
  @property({ type: Boolean }) downloadable = false

  /**
   * 操作栏自定义按钮：JSON 字符串（Vue2 setAttribute 兼容）或数组直传（Vue3/React property）。
   * 每项 { key, label, danger? }；点击派发 action 事件，detail 携带 key 与当前文件信息
   */
  @property() actions: string | FvActionItem[] = ''

  /**
   * 播放器控件配置（仅 video / audio 类型生效）：JSON 字符串（Vue2 兼容）或对象/数组直传。
   * 对象 = 覆盖默认值（如 {"skip":15}）；数组 = 白名单（如 ["progress"]）。
   * 可配置项：skip（快退快进步长秒，false 隐藏）/ rate（倍速）/ volume（音量）/ loop（循环）/ fullscreen（全屏，仅视频）/ progress（进度条）
   */
  @property() controls: string | FvPlayerControls | readonly string[] = ''

  /**
   * 水印配置（所有预览类型生效）：JSON 字符串（Vue2 setAttribute 兼容）或对象直传（Vue3/React property）。
   * { text, image, width, height, fontSize, color, opacity, rotate, gap }
   * text 与 image 二选一（image 优先）；大小用 width/height（或文字 fontSize）控制。
   * 生成平铺图案覆盖预览区（pointer-events:none，不影响交互）
   */
  @property() watermark: string | FvWatermarkOptions = ''

  /** 检测出的媒体类型（null = 未确定 / 失败） */
  @state() private resolved: MediaType | null = null
  @state() private detectError: string | null = null
  /** 水印平铺图案（null = 无水印） */
  @state() private wmTile: WatermarkTile | null = null
  /** slot="action" 中是否分配到了内容（决定操作栏是否显示） */
  @state() private hasSlotActions = false

  @query('file-preview-image') private imageCmp!: FilePreviewImage
  @query('file-preview-video') private videoCmp!: FilePreviewVideo
  @query('file-preview-audio') private audioCmp!: FilePreviewAudio
  @query('file-preview-pdf') private pdfCmp!: FilePreviewPdf
  @query('file-preview-text') private textCmp!: FilePreviewText
  @query('file-preview-markdown') private markdownCmp!: FilePreviewMarkdown
  @query('file-preview-docx') private docxCmp!: FilePreviewDocx
  @query('file-preview-xlsx') private xlsxCmp!: FilePreviewXlsx

  /** 竞态令牌：连续变更 src 时只保留最后一次检测结果 */
  private resolveToken = 0
  private resolveScheduled = false
  /** 竞态令牌：连续变更 watermark 时只保留最后一次生成结果 */
  private wmToken = 0

  static styles = [
    themeStyles,
    css`
      .wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      /* ---------- 操作栏（下载 / 自定义按钮） ---------- */
      .action-bar {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        padding: 4px 8px;
        margin-bottom: 6px;
        background: var(--fv-surface);
        border-radius: var(--fv-radius);
      }
      .action-bar[hidden] {
        display: none;
      }
      .action-bar slot {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .action-btn {
        padding: 5px 12px;
        border: 1px solid var(--fv-surface-2);
        border-radius: 8px;
        background: transparent;
        color: var(--fv-text);
        font-size: 12px;
        line-height: 1.4;
        white-space: nowrap;
        cursor: pointer;
        transition: border-color 0.15s, color 0.15s;
      }
      .action-btn:hover {
        border-color: var(--fv-primary);
        color: var(--fv-primary);
      }
      .action-btn.danger {
        color: var(--fv-error);
        border-color: rgba(239, 68, 68, 0.45);
      }
      .action-btn.danger:hover {
        border-color: var(--fv-error);
      }
      .preview-area {
        position: relative; /* 水印覆盖层的定位基准 */
        flex: 1;
        min-height: 0;
      }
      /* ---------- 水印层：平铺图案覆盖预览区，不影响交互 ---------- */
      .fv-watermark {
        position: absolute;
        inset: 0;
        z-index: 20;
        pointer-events: none;
        background-repeat: repeat;
      }
    `
  ]

  protected willUpdate(changed: Map<string, unknown>) {
    // 主题色
    if (changed.has('color')) {
      if (this.color) this.style.setProperty('--fv-primary', this.color)
      else this.style.removeProperty('--fv-primary')
    }
    // 与类型检测相关的属性变化 → 重新检测
    if (changed.has('src') || changed.has('type') || changed.has('name') || changed.has('mime')) {
      if (changed.has('src')) {
        this.resolved = null
        this.detectError = null
      }
      this.scheduleResolve()
    }
    // 水印配置变化 → 重新生成平铺图案
    if (changed.has('watermark')) this.updateWatermark()
  }

  connectedCallback() {
    super.connectedCallback()
    this.scheduleResolve()
  }

  /** 微任务防抖：一次渲染周期内多次属性变更只触发一次检测 */
  private scheduleResolve() {
    if (this.resolveScheduled) return
    this.resolveScheduled = true
    queueMicrotask(() => {
      this.resolveScheduled = false
      void this.resolveType()
    })
  }

  private async resolveType() {
    const token = ++this.resolveToken

    if (!this.src) {
      this.resolved = null
      this.detectError = null
      return
    }

    // 1. 显式指定
    if (this.type !== 'auto') {
      this.resolved = this.type
      this.detectError = null
      return
    }

    // 2. 同步检测（mime 属性 / name 扩展名 / URL 扩展名 / data: URL）
    const syncResult = detectType(this.src, this.name, this.mime)
    if (syncResult) {
      this.resolved = syncResult
      this.detectError = null
      return
    }

    // 3. 异步兜底：HEAD 请求读 Content-Type
    const headResult = await detectTypeByHead(this.src)
    if (token !== this.resolveToken) return // 已被后续变更取代
    if (headResult) {
      this.resolved = headResult
      this.detectError = null
    } else {
      this.resolved = null
      this.detectError = '无法识别文件类型，请通过 type 属性显式指定'
      const detail: FvErrorDetail = { code: 'unsupported-type', message: this.detectError }
      emit(this, 'error', detail)
    }
  }

  /* ---------- 命令式方法（按当前媒体类型转发） ---------- */

  /** 图片：重置视图 */
  reset(): void {
    this.imageCmp?.reset()
  }
  /** 图片：缩放到指定倍数 */
  zoomTo(scale: number): void {
    this.imageCmp?.zoomTo(scale)
  }
  /** 图片：按倍率缩放 */
  zoomBy(factor: number): void {
    this.imageCmp?.zoomBy(factor)
  }
  /** 图片：旋转到指定角度 */
  rotateTo(angle: number): void {
    this.imageCmp?.rotateTo(angle)
  }
  /** 图片：相对旋转 */
  rotateBy(delta: number): void {
    this.imageCmp?.rotateBy(delta)
  }

  /** 播放类：播放 */
  play(): Promise<void> {
    return this.mediaCmp?.play() ?? Promise.resolve()
  }
  /** 播放类：暂停 */
  pause(): void {
    this.mediaCmp?.pause()
  }
  /** 播放类：跳转到指定时间（秒） */
  seek(time: number): void {
    this.mediaCmp?.seek(time)
  }
  /** 播放类：设置音量（0~1） */
  setVolume(v: number): void {
    this.mediaCmp?.setVolume(v)
  }
  /** 播放类：快进（正数）/ 快退（负数），单位秒 */
  skip(delta: number): void {
    this.mediaCmp?.skip(delta)
  }
  /** 播放类：设置倍速（0.25 ~ 4） */
  setRate(rate: number): void {
    this.mediaCmp?.setRate(rate)
  }

  /** PDF：跳转到指定页（1 起） */
  goToPage(n: number): void {
    this.pdfCmp?.goToPage(n)
  }
  /** PDF：下一页 */
  nextPage(): void {
    this.pdfCmp?.nextPage()
  }
  /** PDF：上一页 */
  prevPage(): void {
    this.pdfCmp?.prevPage()
  }

  /** 获取内部媒体元素（img / video / audio），供高级用法 */
  getMediaElement(): HTMLImageElement | HTMLMediaElement | undefined {
    return this.imageCmp?.getMediaElement() ?? this.mediaCmp?.getMediaElement()
  }

  /** 重新加载当前文件 */
  reload(): void {
    this.activeChild?.reload()
  }

  /** 下载当前预览文件（fetch 转 blob 保存；跨域失败时回退浏览器直接打开原地址） */
  async download(): Promise<void> {
    if (!this.src) return
    const filename = this.name || this.filenameFromUrl(this.src) || 'download'
    const save = (href: string, fallback: boolean): void => {
      const a = document.createElement('a')
      a.href = href
      a.download = filename
      // 回退场景多为跨域，新开标签避免替换当前页
      if (fallback) a.target = '_blank'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      const detail: FvDownloadDetail = { filename, src: this.src, fallback }
      emit(this, 'download', detail)
    }
    // blob / data URL 与页面同源，a 标签直接保存
    if (/^(blob:|data:)/i.test(this.src)) return save(this.src, false)
    try {
      const res = await fetch(this.src)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      save(url, false)
      // 稍延迟释放，确保下载已启动
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      // 跨域被拒 / 网络失败：回退为浏览器直接处理原地址
      save(this.src, true)
    }
  }

  /** 从 URL 提取文件名（name 属性缺省时的下载文件名兜底） */
  private filenameFromUrl(src: string): string {
    try {
      const u = new URL(src, (typeof location !== 'undefined' && location.href) || 'http://localhost/')
      const last = u.pathname.split('/').pop() || ''
      return decodeURIComponent(last)
    } catch {
      return ''
    }
  }

  /* ---------- 水印 ---------- */

  /** 解析 watermark（兼容 JSON 字符串与对象直传，非法输入静默忽略） */
  private get watermarkOpts(): FvWatermarkOptions | null {
    const raw = this.watermark
    if (!raw) return null
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      return obj && typeof obj === 'object' ? obj : null
    } catch {
      return null
    }
  }

  /** 生成水印平铺图案（异步：图片水印需先加载图片；竞态令牌防旧结果覆盖新配置） */
  private updateWatermark(): void {
    const token = ++this.wmToken
    const opts = this.watermarkOpts
    if (!opts || (!opts.image && !opts.text)) {
      this.wmTile = null
      return
    }
    void buildWatermarkTile(opts).then((tile) => {
      if (token !== this.wmToken) return // 已被后续变更取代
      this.wmTile = tile
    })
  }

  /* ---------- 操作栏 ---------- */

  /** 解析 actions（兼容 JSON 字符串与数组直传，非法输入静默忽略） */
  private get actionItems(): FvActionItem[] {
    const raw = this.actions
    if (!raw) return []
    try {
      const list = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!Array.isArray(list)) return []
      return list.filter(
        (it): it is FvActionItem => !!it && typeof it.key === 'string' && typeof it.label === 'string'
      )
    } catch {
      return []
    }
  }

  /** 是否显示操作栏 */
  private get hasActionBar(): boolean {
    return this.downloadable || this.actionItems.length > 0 || this.hasSlotActions
  }

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement
    this.hasSlotActions = slot.assignedElements({ flatten: true }).length > 0
  }

  /** 自定义按钮点击 → action 事件（detail 含 key 与当前文件信息，供删除等业务接口使用） */
  private onActionClick(item: FvActionItem): void {
    const detail: FvActionDetail = {
      key: item.key,
      src: this.src,
      name: this.name,
      type: this.resolved
    }
    emit(this, 'action', detail)
  }

  private get mediaCmp(): FilePreviewVideo | FilePreviewAudio | undefined {
    return this.videoCmp ?? this.audioCmp ?? undefined
  }

  /** 当前渲染的子预览组件（未渲染的类型 @query 返回 null） */
  private get activeChild():
    | FilePreviewImage
    | FilePreviewVideo
    | FilePreviewAudio
    | FilePreviewPdf
    | FilePreviewText
    | FilePreviewMarkdown
    | FilePreviewDocx
    | FilePreviewXlsx
    | undefined {
    return (
      this.imageCmp ??
      this.videoCmp ??
      this.audioCmp ??
      this.pdfCmp ??
      this.textCmp ??
      this.markdownCmp ??
      this.docxCmp ??
      this.xlsxCmp ??
      undefined
    )
  }

  /* ---------- 渲染 ---------- */

  protected render() {
    let content: unknown = nothing

    if (!this.src) {
      // 未设置 src：占位
      content = html`
        <div class="fv-error">
          <slot name="empty">${ICON_EMPTY}<div class="fv-error-msg">未设置文件地址（src）</div></slot>
        </div>
      `
    } else if (this.detectError) {
      // 类型识别失败
      content = html`
        <div class="fv-error" part="error-box">
          <slot name="error">${ICON_WARN}<div class="fv-error-msg">${this.detectError}</div></slot>
        </div>
      `
    } else if (!this.resolved) {
      // 检测中（HEAD 异步探测）
      content = html`<div class="fv-loading"><div class="fv-spinner"></div></div>`
    } else if (this.resolved === 'image') {
      content = html`
        <file-preview-image .src=${this.src} .name=${this.name}>
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
          <slot name="empty" slot="empty"></slot>
        </file-preview-image>
      `
    } else if (this.resolved === 'video') {
      content = html`
        <file-preview-video
          .src=${this.src}
          .name=${this.name}
          .poster=${this.poster}
          ?autoplay=${this.autoplay}
          ?muted=${this.muted}
          ?loop=${this.loop}
          .preload=${this.preload}
          .crossorigin=${this.crossorigin}
          .controls=${this.controls}
        >
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
        </file-preview-video>
      `
    } else if (this.resolved === 'audio') {
      content = html`
        <file-preview-audio
          .src=${this.src}
          .name=${this.name}
          .poster=${this.poster}
          ?autoplay=${this.autoplay}
          ?muted=${this.muted}
          ?loop=${this.loop}
          .preload=${this.preload}
          .crossorigin=${this.crossorigin}
          .controls=${this.controls}
        >
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
        </file-preview-audio>
      `
    } else if (this.resolved === 'pdf') {
      content = html`
        <file-preview-pdf .src=${this.src} .name=${this.name} .cMapUrl=${this.cMapUrl}>
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
        </file-preview-pdf>
      `
    } else if (this.resolved === 'text') {
      content = html`
        <file-preview-text .src=${this.src} .name=${this.name}>
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
        </file-preview-text>
      `
    } else if (this.resolved === 'markdown') {
      content = html`
        <file-preview-markdown .src=${this.src} .name=${this.name}>
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
        </file-preview-markdown>
      `
    } else if (this.resolved === 'docx') {
      content = html`
        <file-preview-docx .src=${this.src} .name=${this.name}>
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
        </file-preview-docx>
      `
    } else {
      content = html`
        <file-preview-xlsx .src=${this.src} .name=${this.name}>
          <slot name="loading" slot="loading"></slot>
          <slot name="error" slot="error"></slot>
        </file-preview-xlsx>
      `
    }

    return html`
      <div class="wrapper">
        <div class="action-bar" part="action-bar" ?hidden=${!this.hasActionBar}>
          ${this.actionItems.map(
            (it) => html`
              <button
                class="action-btn ${it.danger ? 'danger' : ''}"
                @click=${() => this.onActionClick(it)}
              >
                ${it.label}
              </button>
            `
          )}
          <slot name="action" @slotchange=${this.onSlotChange}></slot>
          ${this.downloadable
            ? html`<button class="fv-btn" @click=${() => void this.download()} aria-label="下载" title="下载">${ICON_DOWNLOAD}</button>`
            : nothing}
        </div>
        <div class="preview-area">
          ${content}
          ${this.wmTile
            ? html`<div
                class="fv-watermark"
                part="watermark"
                style="background-image:url('${this.wmTile.url}');background-size:${this.wmTile.width}px ${this.wmTile.height}px"
              ></div>`
            : nothing}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'file-preview': FilePreview
  }
}
