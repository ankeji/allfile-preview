import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
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

/** 文本最大渲染字符数（防止超大文件卡死页面） */
const MAX_CHARS = 500_000

/** 缩放范围 */
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

/**
 * <file-preview-text> 文本预览
 *
 * - 自动编码检测（UTF-8 / GB18030 / Big5，中文环境友好）
 * - 等宽字体 + 滚动 + 行号
 * - 悬浮缩放条（右上角）：缩小 / 放大 / 适应宽度（50% ~ 300%）
 * - 事件：load（detail 含 encoding）/ error / zoom
 */
@customElement('file-preview-text')
export class FilePreviewText extends LitElement {
  @property() src = ''
  @property() name = ''

  @state() private text = ''
  @state() private encoding = ''
  @state() private truncated = false
  @state() private loading = true
  @state() private errorMsg: string | null = null
  /** 正文缩放倍数（1 = 原始字号） */
  @state() private zoom = 1

  static styles = [
    themeStyles,
    css`
      .text-viewer {
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
      .body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 12px 0;
      }
      .line {
        display: flex;
        font-family: Consolas, 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: var(--fv-doc-text);
        white-space: pre-wrap;
        word-break: break-all;
      }
      .line-no {
        flex: none;
        width: 52px;
        padding: 0 12px 0 16px;
        text-align: right;
        color: var(--fv-doc-text-dim);
        user-select: none;
        font-variant-numeric: tabular-nums;
      }
      .line-content {
        flex: 1;
        padding-right: 16px;
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
    // 首次渲染及 src 变化时都会进入此分支（首次 changed 包含全部响应式属性）
    if (changed.has('src')) this.loadText()
  }

  private async loadText() {
    if (!this.src) {
      this.text = ''
      this.loading = false
      this.errorMsg = null
      return
    }
    this.loading = true
    this.errorMsg = null
    this.text = ''
    this.truncated = false
    this.zoom = 1
    try {
      const buf = await fetchFileAsArrayBuffer(this.src)
      const decoded = decodeText(buf)
      this.encoding = decoded.encoding
      this.text = decoded.text.length > MAX_CHARS ? decoded.text.slice(0, MAX_CHARS) : decoded.text
      this.truncated = decoded.text.length > MAX_CHARS
      this.loading = false
      const detail: FvLoadDetail = { type: 'text', encoding: decoded.encoding }
      emit(this, 'load', detail)
    } catch (err) {
      this.loading = false
      const message = `文本加载失败：${(err as Error).message}`
      this.errorMsg = message
      const detail: FvErrorDetail = { code: 'load-failed', message }
      emit(this, 'error', detail)
    }
  }

  reload(): void {
    void this.loadText()
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

  /** 适应宽度：正文按容器宽度自动换行，100% 即适应宽度（重复点击幂等） */
  fitWidth(): void {
    this.setZoom(1)
  }

  private get lines(): string[] {
    return this.text.split(/\r\n|\r|\n/)
  }

  protected render() {
    return html`
      <div class="text-viewer">
        <div class="meta-bar" part="toolbar">
          <span class="name">${this.name || this.src}</span>
          <span class="tags">
            <span class="tag">${this.encoding || '--'}</span>
            <span class="tag">${this.lines.length} 行</span>
          </span>
        </div>
        <div class="body" style="zoom:${this.zoom}">
          ${this.lines.map(
            (line, i) => html`
              <div class="line"><span class="line-no">${i + 1}</span><span class="line-content">${line || '\u200b'}</span></div>
            `
          )}
        </div>
        ${this.text && !this.loading && !this.errorMsg
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
          ? html`<div class="truncated-tip">文件过大，仅显示前 ${MAX_CHARS.toLocaleString()} 字符</div>`
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
    'file-preview-text': FilePreviewText
  }
}
