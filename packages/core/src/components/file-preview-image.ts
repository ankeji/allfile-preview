import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { MAX_SCALE, MIN_SCALE, ZOOM_STEP } from '../constants'
import { clamp } from '../utils/clamp'
import { emit } from '../utils/dispatch'
import { themeStyles } from '../styles/theme'
import type { FvErrorDetail, FvLoadDetail, FvRotateDetail, FvZoomDetail } from '../types'

/* ---------- 内联 SVG 图标 ---------- */
const ICON_ZOOM_IN = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_ZOOM_OUT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_ROTATE_LEFT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6" /><path d="M2.5 8a10 10 0 1 1 2.6 9.4" /></svg>`
const ICON_ROTATE_RIGHT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6" /><path d="M21.5 8a10 10 0 1 0-2.6 9.4" /></svg>`
const ICON_RESET = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>`
const ICON_FIT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h6v6H3z" /><path d="M15 3h6v6h-6z" /><path d="M3 15h6v6H3z" /><path d="M15 15h6v6h-6z" /></svg>`
const ICON_ERROR = html`<svg class="fv-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>`
const ICON_EMPTY = html`<svg class="fv-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>`

/**
 * <file-preview-image> 图片查看器
 *
 * - 自适应容器（contain），图片以 fit 尺寸为基准，scale 属性是相对倍数
 * - 滚轮以光标为中心缩放 / 按钮缩放（以视口中心）、适应宽度、旋转、拖拽平移、重置
 * - 工具栏悬浮于预览区底部居中，所有按钮尺寸统一
 * - 事件：load / error / zoom / rotate / reset
 */
@customElement('file-preview-image')
export class FilePreviewImage extends LitElement {
  @property() src = ''
  @property() name = ''

  /** 视图状态（x/y 为相对容器中心的像素偏移） */
  @state() private x = 0
  @state() private y = 0
  /** 相对 fit 尺寸的用户缩放倍数（1 = 刚好适应容器） */
  @state() private userScale = 1
  /** 旋转角度（度，0~359） */
  @state() private angle = 0

  @state() private loading = true
  @state() private errorMsg: string | null = null
  @state() private naturalW = 0
  @state() private naturalH = 0
  /** fit 比例：图片自然尺寸 → 容器尺寸的缩放 */
  @state() private fitScale = 1

  @query('.stage') private stageEl!: HTMLDivElement
  @query('img') private imgEl!: HTMLImageElement

  private resizeObserver: ResizeObserver | null = null

  /** 拖动会话 */
  private dragPointerId: number | null = null
  private dragStart = { x: 0, y: 0, ox: 0, oy: 0 }

  static styles = [
    themeStyles,
    css`
      .viewer {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--fv-stage);
        border-radius: var(--fv-radius);
      }
      .stage {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none;
      }
      img {
        display: block;
        max-width: none;
        transform-origin: center;
        user-select: none;
        -webkit-user-drag: none;
        cursor: grab;
      }
      img.dragging {
        cursor: grabbing;
      }
      .toolbar {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 6px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(8px);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
      }
      /* 工具栏内所有按钮（含旋转/重置/适应宽度）尺寸严格统一 */
      .toolbar .fv-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
      }
      .toolbar .fv-btn svg {
        width: 18px;
        height: 18px;
      }
      .zoom-label {
        flex: none;
        min-width: 48px;
        text-align: center;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--fv-text-dim);
        user-select: none;
      }
    `
  ]

  connectedCallback() {
    super.connectedCallback()
    this.resizeObserver = new ResizeObserver(() => this.measure())
    this.resizeObserver.observe(this)
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    super.disconnectedCallback()
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('src')) {
      this.resetViewState()
    }
  }

  private resetViewState() {
    this.x = 0
    this.y = 0
    this.userScale = 1
    this.angle = 0
    this.loading = true
    this.errorMsg = null
    this.naturalW = 0
    this.naturalH = 0
  }

  /* ---------- 尺寸测量 ---------- */

  private measure() {
    if (!this.stageEl || !this.naturalW || !this.naturalH) return
    const cw = this.stageEl.clientWidth
    const ch = this.stageEl.clientHeight
    if (cw <= 0 || ch <= 0) return
    this.fitScale = Math.min(cw / this.naturalW, ch / this.naturalH)
  }

  /** 实际应用在 img 上的总缩放 */
  private get totalScale(): number {
    return this.fitScale * this.userScale
  }

  private onImgLoad() {
    this.loading = false
    this.errorMsg = null
    this.naturalW = this.imgEl.naturalWidth
    this.naturalH = this.imgEl.naturalHeight
    this.measure()
    const detail: FvLoadDetail = { type: 'image', width: this.naturalW, height: this.naturalH }
    emit(this, 'load', detail)
  }

  private onImgError() {
    this.loading = false
    const msg = `图片加载失败：${this.name || this.src}`
    this.errorMsg = msg
    const detail: FvErrorDetail = { code: 'load-failed', message: msg }
    emit(this, 'error', detail)
  }

  /* ---------- 对外命令式方法 ---------- */

  /** 重置视图（位置 / 缩放 / 旋转） */
  reset(): void {
    this.x = 0
    this.y = 0
    this.userScale = 1
    this.angle = 0
    emit(this, 'reset', {})
  }

  /** 缩放到指定倍数（相对 fit 尺寸），以视口中心为基准 */
  zoomTo(scale: number): void {
    const next = clamp(scale, MIN_SCALE, MAX_SCALE)
    if (next === this.userScale) return
    const ratio = next / this.userScale
    // 以视口中心为基准缩放：保持当前视口中心指向的图片内容不变
    this.x *= ratio
    this.y *= ratio
    this.userScale = next
    const detail: FvZoomDetail = { scale: next }
    emit(this, 'zoom', detail)
  }

  /** 按倍率缩放（如 1.2 = 放大 20%） */
  zoomBy(factor: number): void {
    this.zoomTo(this.userScale * factor)
  }

  /**
   * 适应宽度：缩放至图片宽度恰好撑满容器宽度（以视口中心为基准，
   * 纯计算重复点击幂等；旋转非 0 时按未旋转的原始宽度近似）
   */
  fitWidth(): void {
    if (!this.naturalW || !this.stageEl) return
    const cw = this.stageEl.clientWidth
    if (cw <= 0) return
    this.zoomTo(cw / this.naturalW / this.fitScale)
  }

  /** 旋转到指定角度（度） */
  rotateTo(angle: number): void {
    const next = ((angle % 360) + 360) % 360
    this.angle = next
    const detail: FvRotateDetail = { angle: next }
    emit(this, 'rotate', detail)
  }

  /** 相对旋转（度，正为顺时针） */
  rotateBy(delta: number): void {
    this.rotateTo(this.angle + delta)
  }

  getMediaElement(): HTMLImageElement | undefined {
    return this.imgEl
  }

  reload(): void {
    this.resetViewState()
    // 触发 img 重新加载（同 src 下重置 onload 流程）
    if (this.imgEl) {
      this.imgEl.src = this.src
    }
  }

  /* ---------- 滚轮缩放（以光标为中心） ---------- */

  private onWheel(e: WheelEvent) {
    if (!this.naturalW || this.errorMsg) return
    e.preventDefault()
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
    const next = clamp(this.userScale * factor, MIN_SCALE, MAX_SCALE)
    if (next === this.userScale) return
    const ratio = next / this.userScale

    // 光标相对容器中心的位置
    const rect = this.stageEl.getBoundingClientRect()
    const cx = e.clientX - (rect.left + rect.width / 2)
    const cy = e.clientY - (rect.top + rect.height / 2)

    // zoom-to-cursor：newPos = cursor - (cursor - oldPos) * ratio
    // （旋转非 0 时为近似值）
    this.x = cx - (cx - this.x) * ratio
    this.y = cy - (cy - this.y) * ratio
    this.userScale = next

    const detail: FvZoomDetail = { scale: next }
    emit(this, 'zoom', detail)
  }

  /* ---------- 拖拽平移 ---------- */

  private onPointerDown(e: PointerEvent) {
    if (this.errorMsg || !this.naturalW) return
    if (e.button !== 0) return
    e.preventDefault()
    this.dragPointerId = e.pointerId
    this.dragStart = { x: e.clientX, y: e.clientY, ox: this.x, oy: this.y }
    this.imgEl.setPointerCapture(e.pointerId)
    this.imgEl.classList.add('dragging')
    this.imgEl.addEventListener('pointermove', this.onPointerMove)
    this.imgEl.addEventListener('pointerup', this.onPointerUp)
    this.imgEl.addEventListener('pointercancel', this.onPointerUp)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.dragPointerId !== e.pointerId) return
    this.x = this.dragStart.ox + (e.clientX - this.dragStart.x)
    this.y = this.dragStart.oy + (e.clientY - this.dragStart.y)
  }

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragPointerId !== e.pointerId) return
    this.dragPointerId = null
    this.imgEl.classList.remove('dragging')
    this.imgEl.removeEventListener('pointermove', this.onPointerMove)
    this.imgEl.removeEventListener('pointerup', this.onPointerUp)
    this.imgEl.removeEventListener('pointercancel', this.onPointerUp)
  }

  /* ---------- 渲染 ---------- */

  protected render() {
    const transform = `translate(${this.x}px, ${this.y}px) scale(${this.totalScale}) rotate(${this.angle}deg)`
    const percent = Math.round(this.userScale * 100)

    return html`
      <div class="viewer" @wheel=${this.onWheel}>
        ${this.src
          ? html`
              <div class="stage">
                <img
                  part="media"
                  src=${this.src}
                  alt=${this.name || '预览图片'}
                  draggable="false"
                  style="transform: ${transform}"
                  @load=${this.onImgLoad}
                  @error=${this.onImgError}
                  @pointerdown=${this.onPointerDown}
                />
              </div>
              ${this.loading && !this.errorMsg
                ? html`<div class="fv-loading"><slot name="loading"><div class="fv-spinner"></div></slot></div>`
                : nothing}
              <div class="toolbar" part="toolbar">
                <button class="fv-btn" part="control-button" @click=${() => this.zoomBy(1 / ZOOM_STEP)} aria-label="缩小" title="缩小">${ICON_ZOOM_OUT}</button>
                <span class="zoom-label">${percent}%</span>
                <button class="fv-btn" @click=${() => this.zoomBy(ZOOM_STEP)} aria-label="放大" title="放大">${ICON_ZOOM_IN}</button>
                <button class="fv-btn" @click=${() => this.fitWidth()} aria-label="适应宽度" title="适应宽度">${ICON_FIT}</button>
                <button class="fv-btn" @click=${() => this.rotateBy(-90)} aria-label="向左旋转" title="向左旋转">${ICON_ROTATE_LEFT}</button>
                <button class="fv-btn" @click=${() => this.rotateBy(90)} aria-label="向右旋转" title="向右旋转">${ICON_ROTATE_RIGHT}</button>
                <button class="fv-btn" @click=${() => this.reset()} aria-label="重置" title="重置">${ICON_RESET}</button>
              </div>
            `
          : html`
              <div class="fv-error">
                <slot name="empty">${ICON_EMPTY}<div class="fv-error-msg">未设置文件地址（src）</div></slot>
              </div>
            `}
        ${this.errorMsg
          ? html`
              <div class="fv-error" part="error-box">
                <slot name="error">${ICON_ERROR}<div class="fv-error-msg">${this.errorMsg}</div></slot>
              </div>
            `
          : nothing}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'file-preview-image': FilePreviewImage
  }
}
