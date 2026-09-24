import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { marked } from 'marked'
import { clamp } from '../utils/clamp'
import { emit } from '../utils/dispatch'
import { fetchFileAsArrayBuffer } from '../utils/fetch-file'
import { decodeText } from '../utils/decode-text'
import { themeStyles } from '../styles/theme'
import type { FvErrorDetail, FvLoadDetail, FvZoomDetail } from '../types'

/* ---------- 内联 SVG 图标 ---------- */
const ICON_ZOOM_IN = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="11" cy="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_ZOOM_OUT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_FIT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h6v6H3z" /><path d="M15 3h6v6h-6z" /><path d="M3 15h6v6H3z" /><path d="M15 15h6v6h-6z" /></svg>`

/** 源文本最大解析字符数（防止超大文件卡死页面） */
const MAX_CHARS = 500_000

/** 缩放范围 */
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

/** 正文排版最大宽度（px）：fitWidth 计算与 .md-body 的 max-width 对应 */
const DOC_WIDTH = 860

/**
 * <file-preview-markdown> Markdown 预览
 *
 * - marked 本地解析渲染（局域网可用，无外部请求）
 * - 自动编码检测（UTF-8 / GB18030 / Big5，与 text 预览共用解码逻辑）
 * - 完整排版样式：标题 / 代码块 / 表格 / 引用 / 列表 / 链接图片
 * - 悬浮缩放条（右上角）：缩小 / 放大 / 适应宽度（50% ~ 300%）
 * - 注意：marked 不做 HTML 白名单过滤，仅用于渲染可信来源的 Markdown
 *   （渲染不可信内容请先自行 sanitize 再传入）
 * - 事件：load（detail 含 encoding）/ error / zoom
 */
@customElement('file-preview-markdown')
export class FilePreviewMarkdown extends LitElement {
  @property() src = ''
  @property() name = ''

  @state() private encoding = ''
  @state() private charCount = 0
  @state() private truncated = false
  @state() private loading = true
  @state() private errorMsg: string | null = null
  /** 正文缩放倍数（1 = 原始排版宽度） */
  @state() private zoom = 1

  private loadToken = 0

  /** 渲染结果注入容器（marked 输出为 HTML 字符串，异步加载后 innerHTML 注入） */
  @query('.md-body') private bodyEl!: HTMLDivElement
  /** 滚动容器（fitWidth 读取可用宽度） */
  @query('.md-scroll') private scrollEl!: HTMLDivElement

  static styles = [
    themeStyles,
    css`
      .md-viewer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--fv-doc-bg);
        border-radius: var(--fv-radius);
        overflow: hidden;
      }
      .meta-bar {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 14px;
        background: var(--fv-surface);
        color: var(--fv-text-dim);
        font-size: 12px;
      }
      .meta-bar .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta-bar .tags {
        flex: none;
        display: flex;
        gap: 6px;
      }
      .tag {
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--fv-surface-2);
        font-variant-numeric: tabular-nums;
      }
      .md-scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
      .md-body {
        max-width: ${DOC_WIDTH}px;
        margin: 0 auto;
        padding: 24px 32px 48px;
        color: var(--fv-doc-text);
        font-size: 14px;
        line-height: 1.7;
        word-wrap: break-word;
      }

      /* ---------- Markdown 排版 ---------- */
      .md-body h1,
      .md-body h2,
      .md-body h3,
      .md-body h4,
      .md-body h5,
      .md-body h6 {
        margin: 1.4em 0 0.6em;
        font-weight: 600;
        line-height: 1.35;
      }
      .md-body h1:first-child,
      .md-body h2:first-child,
      .md-body h3:first-child {
        margin-top: 0.2em;
      }
      .md-body h1 {
        font-size: 1.7em;
        padding-bottom: 0.35em;
        border-bottom: 1px solid var(--fv-doc-border);
      }
      .md-body h2 {
        font-size: 1.4em;
        padding-bottom: 0.3em;
        border-bottom: 1px solid var(--fv-doc-border);
      }
      .md-body h3 {
        font-size: 1.2em;
      }
      .md-body h4 {
        font-size: 1.05em;
      }
      .md-body h5,
      .md-body h6 {
        font-size: 1em;
        color: var(--fv-doc-text-dim);
      }
      .md-body p {
        margin: 0.7em 0;
      }
      .md-body a {
        color: var(--fv-primary);
        text-decoration: none;
      }
      .md-body a:hover {
        text-decoration: underline;
      }
      .md-body strong {
        font-weight: 600;
      }
      .md-body em {
        font-style: italic;
      }
      .md-body del {
        color: var(--fv-doc-text-dim);
      }
      .md-body ul,
      .md-body ol {
        margin: 0.7em 0;
        padding-left: 1.8em;
      }
      .md-body li {
        margin: 0.25em 0;
      }
      .md-body li > p {
        margin: 0.4em 0;
      }
      .md-body blockquote {
        margin: 0.9em 0;
        padding: 0.4em 1em;
        border-left: 3px solid var(--fv-primary);
        background: var(--fv-doc-surface);
        border-radius: 0 8px 8px 0;
        color: var(--fv-doc-text-dim);
      }
      .md-body blockquote p {
        margin: 0.3em 0;
      }
      .md-body code {
        padding: 0.15em 0.45em;
        border-radius: 5px;
        background: var(--fv-doc-surface);
        font-family: Consolas, 'Courier New', monospace;
        font-size: 0.88em;
      }
      .md-body pre {
        margin: 0.9em 0;
        padding: 14px 16px;
        border: 1px solid var(--fv-doc-border);
        border-radius: 8px;
        background: var(--fv-doc-surface);
        overflow: auto;
        line-height: 1.6;
      }
      .md-body pre code {
        padding: 0;
        background: transparent;
        font-size: 13px;
        white-space: pre;
      }
      .md-body table {
        margin: 0.9em 0;
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .md-body th,
      .md-body td {
        padding: 8px 12px;
        border: 1px solid var(--fv-doc-border);
        text-align: left;
      }
      .md-body th {
        background: var(--fv-doc-surface);
        font-weight: 600;
        white-space: nowrap;
      }
      .md-body tr:nth-child(2n) td {
        background: var(--fv-doc-surface);
      }
      .md-body img {
        max-width: 100%;
        border-radius: 8px;
      }
      .md-body hr {
        margin: 1.6em 0;
        border: none;
        border-top: 1px solid var(--fv-doc-border);
      }
      .truncated-tip {
        padding: 8px 16px;
        font-size: 12px;
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.08);
        text-align: center;
      }
    `
  ]

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('src')) void this.loadMarkdown()
  }

  /* ---------- 加载 ---------- */

  private async loadMarkdown() {
    const token = ++this.loadToken
    if (!this.src) {
      this.loading = false
      this.errorMsg = null
      this.encoding = ''
      this.charCount = 0
      this.truncated = false
      this.zoom = 1
      if (this.bodyEl) this.bodyEl.innerHTML = ''
      return
    }
    this.loading = true
    this.errorMsg = null
    this.truncated = false
    this.zoom = 1
    if (this.bodyEl) this.bodyEl.innerHTML = ''

    try {
      const buf = await fetchFileAsArrayBuffer(this.src)
      if (token !== this.loadToken) return

      const decoded = decodeText(buf)
      const source =
        decoded.text.length > MAX_CHARS ? decoded.text.slice(0, MAX_CHARS) : decoded.text
      this.encoding = decoded.encoding
      this.charCount = decoded.text.length
      this.truncated = decoded.text.length > MAX_CHARS

      // marked v4 parse 为同步方法（未传 async 选项），返回 HTML 字符串
      const htmlText = marked.parse(source, { gfm: true, breaks: true }) as string
      if (token !== this.loadToken) return
      if (this.bodyEl) this.bodyEl.innerHTML = htmlText

      this.loading = false
      const detail: FvLoadDetail = { type: 'markdown', encoding: decoded.encoding }
      emit(this, 'load', detail)
    } catch (err) {
      if (token !== this.loadToken) return
      this.loading = false
      const message = `Markdown 加载失败：${(err as Error).message}`
      this.errorMsg = message
      const detail: FvErrorDetail = { code: 'load-failed', message }
      emit(this, 'error', detail)
    }
  }

  reload(): void {
    void this.loadMarkdown()
  }

  /* ---------- 缩放 ---------- */

  private setZoom(next: number): void {
    const v = clamp(next, MIN_ZOOM, MAX_ZOOM)
    if (v === this.zoom) return
    this.zoom = v
    const detail: FvZoomDetail = { scale: v }
    emit(this, 'zoom', detail)
  }

  /** 按倍率缩放（如 1.25 = 放大 25%） */
  zoomBy(factor: number): void {
    this.setZoom(this.zoom * factor)
  }

  /**
   * 适应宽度：正文排版宽度撑满滚动容器。
   * 正文自然宽度 = min(排版最大宽度, 容器宽)（纯计算，不依赖运行时测量，重复点击幂等；
   * 向下取整到 1% 步进，避免四舍五入溢出出现横向滚动条破坏幂等性）。
   */
  fitWidth(): void {
    const scroll = this.scrollEl
    if (!scroll) return
    const cw = scroll.clientWidth
    if (cw <= 0) return
    const natural = Math.min(DOC_WIDTH, cw)
    this.setZoom(Math.floor((cw / natural) * 100) / 100)
  }

  protected render() {
    return html`
      <div class="md-viewer">
        <div class="meta-bar" part="toolbar">
          <span class="name">${this.name || this.src}</span>
          <span class="tags">
            <span class="tag">${this.encoding || '--'}</span>
            <span class="tag">${this.charCount.toLocaleString()} 字</span>
          </span>
        </div>
        <div class="md-scroll">
          <div class="md-body" part="media" style="zoom:${this.zoom}"></div>
        </div>
        ${this.charCount > 0 && !this.loading && !this.errorMsg
          ? html`
              <div class="fv-zoom-bar" part="zoom-bar">
                <button class="fv-btn" ?disabled=${this.zoom <= MIN_ZOOM} @click=${() => this.zoomBy(1 / 1.25)} aria-label="缩小" title="缩小">${ICON_ZOOM_OUT}</button>
                <span class="fv-zoom-label">${Math.round(this.zoom * 100)}%</span>
                <button class="fv-btn" ?disabled=${this.zoom >= MAX_ZOOM} @click=${() => this.zoomBy(1.25)} aria-label="放大" title="放大">${ICON_ZOOM_IN}</button>
                <button class="fv-btn" @click=${() => this.fitWidth()} aria-label="适应宽度" title="适应宽度">${ICON_FIT}</button>
              </div>
            `
          : nothing}
        ${this.truncated
          ? html`<div class="truncated-tip">文件过大，仅渲染前 ${MAX_CHARS.toLocaleString()} 字符</div>`
          : nothing}
        ${this.loading && !this.errorMsg
          ? html`<div class="fv-loading"><slot name="loading"><div class="fv-spinner"></div></slot></div>`
          : nothing}
        ${this.errorMsg
          ? html`
              <div class="fv-error" part="error-box">
                <slot name="error">
                  <div class="fv-error-msg">${this.errorMsg}</div>
                </slot>
              </div>
            `
          : nothing}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'file-preview-markdown': FilePreviewMarkdown
  }
}
