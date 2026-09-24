import { LitElement, html } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { themeStyles } from '../styles/theme'
import type { FvPlayerControls } from '../types'
import type { FilePreviewPlayer } from './media/file-preview-player'
import './media/file-preview-player'

/**
 * <file-preview-audio> 音频预览（file-preview-player 的 audio 形态薄壳）
 *
 * 卡片式布局：封面（poster 或音符动画）+ 标题（name）+ 统一控件条。
 * 事件由内部 player 以 composed CustomEvent 冒泡透出。
 */
@customElement('file-preview-audio')
export class FilePreviewAudio extends LitElement {
  @property() src = ''
  @property() name = ''
  @property() poster = ''
  @property({ type: Boolean }) autoplay = false
  @property({ type: Boolean }) muted = false
  @property({ type: Boolean }) loop = false
  @property() preload = 'metadata'
  @property() crossorigin = ''
  /** 控件配置（透传给 player）：对象覆盖式 / 数组白名单 / JSON 字符串 */
  @property({ attribute: false }) controls: string | FvPlayerControls | readonly string[] = ''

  @query('file-preview-player') private player!: FilePreviewPlayer

  static styles = [themeStyles]

  /* ---------- 命令式方法 ---------- */
  play(): Promise<void> {
    return this.player?.play() ?? Promise.resolve()
  }
  pause(): void {
    this.player?.pause()
  }
  seek(time: number): void {
    this.player?.seek(time)
  }
  setVolume(v: number): void {
    this.player?.setVolume(v)
  }
  /** 快进（正数）/ 快退（负数），单位秒 */
  skip(delta: number): void {
    this.player?.skip(delta)
  }
  /** 设置倍速（0.25 ~ 4） */
  setRate(rate: number): void {
    this.player?.setRate(rate)
  }
  getMediaElement(): HTMLMediaElement | undefined {
    return this.player?.getMediaElement()
  }
  reload(): void {
    this.player?.reload()
  }

  protected render() {
    return html`
      <file-preview-player
        kind="audio"
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
      </file-preview-player>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'file-preview-audio': FilePreviewAudio
  }
}
