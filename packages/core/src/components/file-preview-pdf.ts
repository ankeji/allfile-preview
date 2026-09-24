import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import * as pdfjsLib from 'pdfjs-dist'
import workerCode from 'pdfjs-dist/build/pdf.worker.min.js?raw'
import { clamp } from '../utils/clamp'
import { emit } from '../utils/dispatch'
import { fetchFileAsArrayBuffer } from '../utils/fetch-file'
import { themeStyles } from '../styles/theme'
import type { FvErrorDetail, FvLoadDetail, FvPageDetail } from '../types'

/* ---------- 图标 ---------- */
const ICON_PREV = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>`
const ICON_NEXT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>`
const ICON_ZOOM_IN = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_ZOOM_OUT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_FIT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h6v6H3z" /><path d="M15 3h6v6h-6z" /><path d="M3 15h6v6H3z" /><path d="M15 15h6v6h-6z" /></svg>`

/* ---------- worker 初始化（Blob URL，局域网 / file:// 均可用，无外部请求） ---------- */
let workerReady = false
function ensureWorker(): void {
  if (workerReady) return
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)
  workerReady = true
}

/** 缩放范围（相对适应宽度的倍数） */
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

/**
 * <file-preview-pdf> PDF 预览（pdf.js 本地渲染，无任何外部 CDN 请求）
 *
 * - 分页浏览（上一页/下一页/页码跳转，底部栏）
 * - 悬浮缩放条（右上角）：缩小 / 放大 / 适应宽度（相对"适应宽度"的倍率）
 * - cMapUrl 属性：中文等非嵌入字体 PDF 需指向 pdfjs cmaps 目录（见 README 局域网部署说明）
 * - 事件：load / error / pagechange / zoom
 */
@customElement('file-preview-pdf')
export class FilePreviewPdf extends LitElement {
  @property() src = ''
  @property() name = ''
  /** pdfjs cMaps 目录地址（如 /pdf/cmaps/，结尾带斜杠），用于非嵌入字体的中文 PDF */
  @property() cMapUrl = ''

  @state() private loading = true
  @state() private errorMsg: string | null = null
  @state() private pageNum = 1
  @state() private pages = 0
  /** 相对"适应宽度"的缩放倍数 */
  @state() private zoomFactor = 1

  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
  private fitScale = 1
  private renderTask: pdfjsLib.RenderTask | null = null
  private renderToken = 0
  private resizeObserver: ResizeObserver | null = null

  @query('.pdf-body') private bodyEl!: HTMLDivElement
  @query('canvas') private canvasEl!: HTMLCanvasElement

  static styles = [
    themeStyles,
    css`
      .pdf-viewer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--fv-stage);
        border-radius: var(--fv-radius);
        overflow: hidden;
      }
      .pdf-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: flex;
        justify-content: center;
        padding: 16px;
      }
      canvas {
        display: block;
        background: #fff;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
        border-radius: 2px;
      }
      .controls {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 6px 10px;
        background: var(--fv-surface);
      }
      .page-input {
        width: 52px;
        height: 30px;
        padding: 0 6px;
        border: 1px solid var(--fv-surface-2);
        border-radius: 8px;
        background: transparent;
        color: var(--fv-text);
        font-size: 13px;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .page-input:focus {
        outline: none;
        border-color: var(--fv-primary);
      }
      .pages-total {
        font-size: 12px;
        color: var(--fv-text-dim);
        padding: 0 4px;
        font-variant-numeric: tabular-nums;
      }
    `
  ]

  connectedCallback() {
    super.connectedCallback()
    this.resizeObserver = new ResizeObserver(() => {
      if (this.pdfDoc) this.measureAndRender()
    })
    this.resizeObserver.observe(this)
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.renderTask?.cancel()
    this.pdfDoc?.destroy()
    this.pdfDoc = null
    super.disconnectedCallback()
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('src') || changed.has('cMapUrl')) void this.loadPdf()
  }

  /* ---------- 加载 ---------- */

  private async loadPdf() {
    this.renderToken++
    this.renderTask?.cancel()
    await this.pdfDoc?.destroy()
    this.pdfDoc = null

    if (!this.src) {
      this.loading = false
      this.errorMsg = null
      return
    }
    this.loading = true
    this.errorMsg = null
    this.pageNum = 1
    this.pages = 0
    this.zoomFactor = 1

    try {
      ensureWorker()
      const data = new Uint8Array(await fetchFileAsArrayBuffer(this.src))
      const doc = await pdfjsLib.getDocument({
        data,
        cMapUrl: this.cMapUrl || undefined,
        cMapPacked: true
      }).promise
      this.pdfDoc = doc
      this.pages = doc.numPages
      this.loading = false
      const detail: FvLoadDetail = { type: 'pdf', pages: doc.numPages }
      emit(this, 'load', detail)
      this.measureAndRender()
    } catch (err) {
      const errName = (err as { name?: string })?.name
      if (errName === 'AbortException') return
      this.loading = false
      // 加密 PDF：pdfjs 抛 PasswordException（No password given / Incorrect password）
      const message =
        errName === 'PasswordException'
          ? 'PDF 文件已加密，暂不支持预览带密码的 PDF'
          : `PDF 加载失败：${(err as Error).message}`
      this.errorMsg = message
      const detail: FvErrorDetail = { code: 'load-failed', message }
      emit(this, 'error', detail)
    }
  }

  /* ---------- 渲染 ---------- */

  /** 依据容器宽度计算适应比例并渲染当前页 */
  private measureAndRender(): void {
    if (!this.pdfDoc || !this.bodyEl) return
    void this.withPage((page) => {
      const vp1 = page.getViewport({ scale: 1 })
      const available = Math.max(this.bodyEl.clientWidth - 32, 120)
      this.fitScale = available / vp1.width
      void this.renderCurrentPage()
    })
  }

  private async withPage(fn: (page: pdfjsLib.PDFPageProxy) => void): Promise<void> {
    if (!this.pdfDoc) return
    const page = await this.pdfDoc.getPage(clamp(this.pageNum, 1, this.pages || 1))
    fn(page)
  }

  private async renderCurrentPage(): Promise<void> {
    if (!this.pdfDoc) return
    const token = ++this.renderToken
    this.renderTask?.cancel()
    await this.withPage((page) => {
      if (token !== this.renderToken) return
      const dpr = window.devicePixelRatio || 1
      const cssScale = this.fitScale * this.zoomFactor
      const viewport = page.getViewport({ scale: cssScale * dpr })
      const canvas = this.canvasEl
      if (!canvas) return
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const task = page.render({ canvasContext: ctx, viewport })
      this.renderTask = task
      void task.promise.catch(() => {
        /* 被新渲染任务取消，忽略 */
      })
    })
  }

  /* ---------- 命令式方法 ---------- */

  /** 跳转到指定页（1 起） */
  goToPage(n: number): void {
    const page = clamp(Math.floor(n), 1, this.pages || 1)
    if (page === this.pageNum) return
    this.pageNum = page
    this.emitPageChange()
    this.measureAndRender()
  }
  nextPage(): void {
    this.goToPage(this.pageNum + 1)
  }
  prevPage(): void {
    this.goToPage(this.pageNum - 1)
  }
  zoomBy(factor: number): void {
    const next = clamp(this.zoomFactor * factor, MIN_ZOOM, MAX_ZOOM)
    if (next === this.zoomFactor) return
    this.zoomFactor = next
    emit(this, 'zoom', { scale: next })
    void this.renderCurrentPage()
  }
  /** 重置为适应宽度 */
  fitWidth(): void {
    this.zoomFactor = 1
    emit(this, 'zoom', { scale: 1 })
    void this.renderCurrentPage()
  }
  reload(): void {
    void this.loadPdf()
  }

  private emitPageChange(): void {
    const detail: FvPageDetail = { page: this.pageNum, pages: this.pages }
    emit(this, 'pagechange', detail)
  }

  /* ---------- 交互 ---------- */

  private onPageInput(e: Event): void {
    const input = e.target as HTMLInputElement
    const n = parseInt(input.value, 10)
    if (Number.isFinite(n)) this.goToPage(n)
  }

  protected render() {
    return html`
      <div class="pdf-viewer">
        <div class="pdf-body" part="media">
          <canvas></canvas>
        </div>
        <div class="fv-zoom-bar" part="zoom-bar">
          <button class="fv-btn" ?disabled=${this.zoomFactor <= MIN_ZOOM} @click=${() => this.zoomBy(1 / 1.25)} aria-label="缩小" title="缩小">${ICON_ZOOM_OUT}</button>
          <span class="fv-zoom-label">${Math.round(this.zoomFactor * 100)}%</span>
          <button class="fv-btn" ?disabled=${this.zoomFactor >= MAX_ZOOM} @click=${() => this.zoomBy(1.25)} aria-label="放大" title="放大">${ICON_ZOOM_IN}</button>
          <button class="fv-btn ${this.zoomFactor === 1 ? 'active' : ''}" @click=${() => this.fitWidth()} aria-label="适应宽度" title="适应宽度">${ICON_FIT}</button>
        </div>
        <div class="controls" part="toolbar">
          <button class="fv-btn" ?disabled=${this.pageNum <= 1} @click=${() => this.prevPage()} aria-label="上一页" title="上一页">${ICON_PREV}</button>
          <input
            class="page-input"
            type="number"
            min="1"
            max=${this.pages || 1}
            .value=${String(this.pageNum)}
            @change=${this.onPageInput}
            aria-label="页码"
          />
          <span class="pages-total">/ ${this.pages || '--'}</span>
          <button class="fv-btn" ?disabled=${this.pageNum >= this.pages} @click=${() => this.nextPage()} aria-label="下一页" title="下一页">${ICON_NEXT}</button>
        </div>
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
    'file-preview-pdf': FilePreviewPdf
  }
}
