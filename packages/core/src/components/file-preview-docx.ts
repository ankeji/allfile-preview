import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { renderAsync } from 'docx-preview'
import { clamp } from '../utils/clamp'
import { emit } from '../utils/dispatch'
import { fetchFileAsArrayBuffer } from '../utils/fetch-file'
import { themeStyles } from '../styles/theme'
import type { FvErrorDetail, FvLoadDetail } from '../types'

/* ---------- 图标 ---------- */
const ICON_ZOOM_IN = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_ZOOM_OUT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_FIT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3h6v6H3z" /><path d="M15 3h6v6h-6z" /><path d="M3 15h6v6H3z" /><path d="M15 15h6v6h-6z" /></svg>`

/** 缩放范围 */
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

/**
 * <file-preview-docx> Word（.docx）预览
 *
 * - docx-preview 本地解析渲染（局域网可用，无外部请求）
 * - 样式注入 shadow DOM 内的独立容器，不污染宿主页面
 * - 加载时自动"适应宽度"（页面比容器宽时按比例缩小）
 * - 悬浮缩放条（右上角）：缩小 / 放大 / 适应宽度（50% ~ 300%）
 * - 仅支持 .docx（.doc 老二进制格式不支持，会在加载时报错）
 * - 事件：load / error / zoom
 */
@customElement('file-preview-docx')
export class FilePreviewDocx extends LitElement {
  @property() src = ''
  @property() name = ''

  @state() private loading = true
  @state() private errorMsg: string | null = null
  @state() private zoom = 1

  private loadToken = 0
  private resizeObserver: ResizeObserver | null = null
  /** 文档页面的原始宽度（zoom=1 时测量，避免 CSS zoom 影响计算） */
  private naturalWidth = 0

  @query('.docx-scroll') private scrollEl!: HTMLDivElement
  @query('.docx-body') private bodyEl!: HTMLDivElement
  /** docx-preview 样式注入容器（必须位于 shadow root 内，样式才能作用于渲染结果） */
  @query('.docx-styles') private stylesEl!: HTMLDivElement

  static styles = [
    themeStyles,
    css`
      .docx-viewer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--fv-stage);
        border-radius: var(--fv-radius);
        overflow: hidden;
      }
      .toolbar {
        flex: none;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        background: var(--fv-surface);
      }
      .name {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        color: var(--fv-text-dim);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 8px;
      }
      .docx-scroll {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
      .docx-body {
        padding: 16px;
        /* zoom 属性由内联样式动态控制（相对文档原始尺寸的倍率） */
      }
      .docx-styles {
        display: none;
      }
    `
  ]

  connectedCallback() {
    super.connectedCallback()
    this.resizeObserver = new ResizeObserver(() => this.applyFit())
    this.resizeObserver.observe(this)
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    super.disconnectedCallback()
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('src')) void this.loadDocx()
  }

  /* ---------- 加载 ---------- */

  private async loadDocx() {
    const token = ++this.loadToken
    if (!this.src) {
      this.loading = false
      this.errorMsg = null
      return
    }
    this.loading = true
    this.errorMsg = null
    this.zoom = 1
    if (this.bodyEl) this.bodyEl.innerHTML = ''
    if (this.stylesEl) this.stylesEl.innerHTML = ''

    try {
      const data = await fetchFileAsArrayBuffer(this.src)
      if (token !== this.loadToken) return

      await renderAsync(data, this.bodyEl, this.stylesEl, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true
      })
      if (token !== this.loadToken) return

      this.loading = false
      const detail: FvLoadDetail = { type: 'docx' }
      emit(this, 'load', detail)
      this.measureNatural()
      this.applyFit()
    } catch (err) {
      if (token !== this.loadToken) return
      this.loading = false
      const raw = (err as Error)?.message || String(err)
      // JSZip 对非 zip 文件（如 .doc 老格式）报错较晦涩，转成友好提示
      const message = /end of central directory|corrupted/i.test(raw)
        ? '文件解析失败：可能不是有效的 .docx 文件（.doc 老格式请先另存为 .docx）'
        : `文档加载失败：${raw}`
      this.errorMsg = message
      const detail: FvErrorDetail = { code: 'load-failed', message }
      emit(this, 'error', detail)
    }
  }

  /* ---------- 缩放 ---------- */

  /** 测量文档页面原始宽度（仅在 zoom=1 时准确，加载完成后调用一次） */
  private measureNatural(): void {
    if (!this.bodyEl) return
    const page = this.bodyEl.querySelector('.docx-wrapper section.docx') as HTMLElement | null
    this.naturalWidth = page?.offsetWidth || 0
  }

  /** 页面比容器宽时自动缩小以适应宽度（容器变化时也会重算） */
  private applyFit(): void {
    if (!this.naturalWidth || !this.scrollEl) return
    const available = this.scrollEl.clientWidth - 32 // 与 .docx-body padding 匹配
    if (available <= 0) return
    if (this.naturalWidth > available) {
      const fit = clamp(Number((available / this.naturalWidth).toFixed(3)), MIN_ZOOM, 1)
      if (fit !== this.zoom) this.zoom = fit
    }
  }

  zoomBy(factor: number): void {
    const next = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    if (next === this.zoom) return
    this.zoom = next
    emit(this, 'zoom', { scale: next })
  }

  /** 适应宽度：缩放到恰好撑满可用宽度（可放大也可缩小） */
  fitWidth(): void {
    if (!this.naturalWidth || !this.scrollEl) return
    const available = this.scrollEl.clientWidth - 32
    if (available <= 0) return
    const next = clamp(Number((available / this.naturalWidth).toFixed(3)), MIN_ZOOM, MAX_ZOOM)
    if (next === this.zoom) return
    this.zoom = next
    emit(this, 'zoom', { scale: next })
  }

  reload(): void {
    void this.loadDocx()
  }

  protected render() {
    return html`
      <div class="docx-viewer">
        <div class="toolbar" part="toolbar">
          <span class="name">${this.name || this.src}</span>
        </div>
        <div class="docx-scroll">
          <div class="docx-body" style="zoom:${this.zoom}" part="media"></div>
        </div>
        <div class="docx-styles"></div>
        ${!this.loading && !this.errorMsg
          ? html`
              <div class="fv-zoom-bar" part="zoom-bar">
                <button class="fv-btn" ?disabled=${this.zoom <= MIN_ZOOM} @click=${() => this.zoomBy(1 / 1.25)} aria-label="缩小" title="缩小">${ICON_ZOOM_OUT}</button>
                <span class="fv-zoom-label">${Math.round(this.zoom * 100)}%</span>
                <button class="fv-btn" ?disabled=${this.zoom >= MAX_ZOOM} @click=${() => this.zoomBy(1.25)} aria-label="放大" title="放大">${ICON_ZOOM_IN}</button>
                <button class="fv-btn" @click=${() => this.fitWidth()} aria-label="适应宽度" title="适应宽度">${ICON_FIT}</button>
              </div>
            `
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
    'file-preview-docx': FilePreviewDocx
  }
}
