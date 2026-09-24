import { LitElement, css, html } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { clamp } from '../utils/clamp'

/**
 * <fv-slider> 通用滑块（进度条 / 音量条共用）
 *
 * - value / buffered 取值 0~1
 * - vertical 属性切换为竖直方向（音量）
 * - 事件：input（拖动中持续触发）、change（松手触发），detail 为 0~1 的比例
 * - 拖动中内部自管显示值，不受外部 value 回写影响（避免拖动抖动）
 */
@customElement('fv-slider')
export class FvSlider extends LitElement {
  /** 当前值（0~1），受控属性 */
  @property({ type: Number }) value = 0

  /** 已缓冲比例（0~1），仅水平进度条使用 */
  @property({ type: Number }) buffered = 0

  /** 竖直方向（音量条） */
  @property({ type: Boolean, reflect: true }) vertical = false

  /** 禁用 */
  @property({ type: Boolean }) disabled = false

  @query('.track') private trackEl!: HTMLDivElement

  /** 拖动中标志与拖动值 */
  private dragging = false
  private dragValue = 0

  static styles = css`
    :host {
      display: block;
      touch-action: none;
    }
    .track {
      position: relative;
      width: 100%;
      height: 16px;
      display: flex;
      align-items: center;
      cursor: pointer;
      outline: none;
    }
    :host([vertical]) .track {
      width: 16px;
      height: 100%;
      justify-content: center;
    }
    :host([disabled]) .track {
      cursor: default;
      opacity: 0.4;
      pointer-events: none;
    }
    /* 轨道 */
    .rail {
      position: relative;
      width: 100%;
      height: 4px;
      border-radius: 999px;
      background: var(--fv-surface-2);
      overflow: hidden;
      transition: height 0.15s;
    }
    .track:hover .rail,
    .track:focus-visible .rail {
      height: 6px;
    }
    :host([vertical]) .rail {
      width: 4px;
      height: 100%;
    }
    :host([vertical]):hover .rail,
    :host([vertical]) .track:hover .rail {
      width: 6px;
    }
    /* 已缓冲 */
    .buffered {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.25);
    }
    :host([vertical]) .buffered {
      left: 0;
      right: 0;
      bottom: auto;
      width: 100%;
    }
    /* 已播放填充 */
    .filled {
      position: absolute;
      background: var(--fv-primary);
    }
    /* 滑块圆点 */
    .thumb {
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      transform: translate(-50%, -50%);
      transition: transform 0.15s;
    }
    .track:hover .thumb {
      transform: translate(-50%, -50%) scale(1.15);
    }
    /* 焦点可达性 */
    .track:focus-visible {
      outline: 2px solid var(--fv-primary);
      outline-offset: 2px;
      border-radius: 4px;
    }
  `

  /** 当前用于渲染的值 */
  private get displayValue(): number {
    return this.dragging ? this.dragValue : clamp(this.value, 0, 1)
  }

  protected render() {
    const v = this.displayValue * 100
    const vertical = this.vertical
    const filledStyle = vertical
      ? `width:100%;height:${v}%;bottom:0;left:0;`
      : `height:100%;width:${v}%;top:0;left:0;`
    const bufferedStyle = vertical
      ? `width:100%;height:${this.buffered * 100}%;bottom:0;left:0;`
      : `height:100%;width:${this.buffered * 100}%;top:0;left:0;`
    const thumbStyle = vertical
      ? `left:50%;bottom:${v}%;top:auto;`
      : `top:50%;left:${v}%;`

    return html`
      <div
        class="track"
        role="slider"
        tabindex=${this.disabled ? -1 : 0}
        aria-valuemin="0"
        aria-valuemax="100"
        .ariaValuenow=${Math.round(this.displayValue * 100)}
        .ariaDisabled=${this.disabled}
        @pointerdown=${this.onPointerDown}
        @keydown=${this.onKeyDown}
      >
        <div class="rail" part="rail">
          <div class="buffered" style=${bufferedStyle}></div>
          <div class="filled" style=${filledStyle} part="progress"></div>
        </div>
        <div class="thumb" style=${thumbStyle}></div>
      </div>
    `
  }

  /** 由指针事件计算 0~1 比例 */
  private ratioFromEvent(e: PointerEvent): number {
    const rect = this.trackEl.getBoundingClientRect()
    if (this.vertical) {
      return clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1)
    }
    return clamp((e.clientX - rect.left) / rect.width, 0, 1)
  }

  private onPointerDown(e: PointerEvent) {
    if (this.disabled) return
    e.preventDefault()
    this.dragging = true
    this.dragValue = this.ratioFromEvent(e)
    // 捕获指针：移出元素也能继续接收 move/up
    this.trackEl.setPointerCapture(e.pointerId)
    this.trackEl.addEventListener('pointermove', this.onPointerMove)
    this.trackEl.addEventListener('pointerup', this.onPointerUp)
    this.trackEl.addEventListener('pointercancel', this.onPointerUp)
    this.dispatchEventValue('input')
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return
    this.dragValue = this.ratioFromEvent(e)
    this.dispatchEventValue('input')
    // 拖动中手动触发重渲染（dragValue 非响应式属性）
    this.requestUpdate()
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) return
    this.dragging = false
    this.dragValue = this.ratioFromEvent(e)
    this.trackEl.removeEventListener('pointermove', this.onPointerMove)
    this.trackEl.removeEventListener('pointerup', this.onPointerUp)
    this.trackEl.removeEventListener('pointercancel', this.onPointerUp)
    this.dispatchEventValue('change')
    this.requestUpdate()
  }

  /** 键盘可达：方向键 ±5% */
  private onKeyDown(e: KeyboardEvent) {
    if (this.disabled) return
    const step = 0.05
    let next: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = this.displayValue - step
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = this.displayValue + step
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = 1
    if (next === null) return
    e.preventDefault()
    next = clamp(next, 0, 1)
    this.value = next
    this.dispatchEventValue('input')
    this.dispatchEventValue('change')
  }

  private dispatchEventValue(name: 'input' | 'change') {
    const v = this.dragging ? this.dragValue : clamp(this.value, 0, 1)
    this.dispatchEvent(new CustomEvent(name, { detail: v, bubbles: true, composed: true }))
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fv-slider': FvSlider
  }
}
