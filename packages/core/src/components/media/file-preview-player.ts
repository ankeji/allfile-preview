import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import { TIMEUPDATE_THROTTLE } from '../../constants'
import { emit } from '../../utils/dispatch'
import { formatTime } from '../../utils/format-time'
import { clamp } from '../../utils/clamp'
import { themeStyles } from '../../styles/theme'
import type {
  FvErrorDetail,
  FvFullscreenDetail,
  FvLoadDetail,
  FvPlayerControls,
  FvRateDetail,
  FvSeekDetail,
  FvTimeupdateDetail,
  FvVolumeDetail
} from '../../types'
import '../fv-slider'

/* ---------- 内联 SVG 图标 ---------- */
const ICON_PLAY = html`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.54-6.86a1.05 1.05 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14z" /></svg>`
const ICON_PAUSE = html`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>`
const ICON_SKIP_BACK = html`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12l8-5.5v11L12 12z" /><path d="M3 12l8-5.5v11L3 12z" /></svg>`
const ICON_SKIP_FWD = html`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12L4 6.5v11L12 12z" /><path d="M21 12l-8-5.5v11L21 12z" /></svg>`
const ICON_FULL = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>`
const ICON_FULL_EXIT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>`
const ICON_VOL_HIGH = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>`
const ICON_VOL_LOW = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>`
const ICON_VOL_MUTE = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none" /><line x1="16" y1="9" x2="22" y2="15" /><line x1="22" y1="9" x2="16" y2="15" /></svg>`
const ICON_LOOP = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg>`
const ICON_MUSIC = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="18" r="3" /><circle cx="18" cy="15.5" r="3" /><path d="M9.5 18V5.5l12-2.5v12.5" /></svg>`
const ICON_ERROR = html`<svg class="fv-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>`
const ICON_RETRY = html`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>`

/** 倍速档位（点击按钮循环切换） */
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

/**
 * <file-preview-player> 统一播放器（内部组件）
 *
 * video / audio 两种形态共用同一套控件：
 * 播放/暂停、快退/快进（步长可配）、可拖拽进度条（含缓冲显示）、时间显示、
 * 音量拖拽 + 静音、倍速切换、循环开关、全屏（仅视频）、加载态、错误态 + 重试。
 * 控件显隐与参数通过 controls 属性配置（对象覆盖式 / 数组白名单），
 * video 形态支持点击画面切换播放。
 *
 * 对外派发事件：load / error / play / pause / ended / timeupdate / seek / volumechange / ratechange / fullscreenchange
 */
@customElement('file-preview-player')
export class FilePreviewPlayer extends LitElement {
  /** 播放器形态 */
  @property() kind: 'video' | 'audio' = 'video'

  @property() src = ''
  @property() name = ''
  @property() poster = ''
  @property({ type: Boolean }) autoplay = false
  @property({ type: Boolean }) muted = false
  @property({ type: Boolean }) loop = false
  @property() preload = 'metadata'
  @property() crossorigin = ''

  /**
   * 控件配置：JSON 字符串 / 对象（覆盖默认值）/ 数组（白名单）。
   * 可配置项见 FvPlayerControls：skip / rate / volume / loop / fullscreen / progress
   */
  @property({ attribute: false }) controls: string | FvPlayerControls | readonly string[] = ''

  @state() private playing = false
  @state() private duration = 0
  @state() private currentTime = 0
  /** 进度条拖动中的预览时间（null 表示非拖动） */
  @state() private previewTime: number | null = null
  @state() private volume = 1
  @state() private isMuted = false
  @state() private loading = true
  @state() private errorMsg: string | null = null
  @state() private bufferedRatio = 0
  /** 当前倍速 */
  @state() private rate = 1
  /** 是否处于全屏（仅视频） */
  @state() private isFullscreen = false

  @query('video, audio') private media!: HTMLMediaElement
  @query('.player') private playerRoot!: HTMLDivElement

  private lastVolume = 1
  private lastTimeupdateAt = 0

  static styles = [
    themeStyles,
    css`
      .player {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--fv-stage);
        border-radius: var(--fv-radius);
        overflow: hidden;
        color: var(--fv-text);
      }

      /* ---------- video 形态 ---------- */
      .media-area {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #000;
        overflow: hidden;
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        cursor: pointer;
      }
      /* 中央大播放按钮（未播放时） */
      .big-play {
        position: absolute;
        inset: 0;
        margin: auto;
        width: 64px;
        height: 64px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        transition: transform 0.15s, background 0.15s;
      }
      .big-play:hover {
        background: rgba(0, 0, 0, 0.65);
        transform: scale(1.08);
      }
      .big-play svg {
        width: 30px;
        height: 30px;
        margin-left: 3px;
      }

      /* ---------- audio 形态 ---------- */
      .audio-body {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 18px 20px;
      }
      .cover {
        flex: none;
        width: 88px;
        height: 88px;
        border-radius: 12px;
        background: var(--fv-surface);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--fv-text-dim);
        overflow: hidden;
      }
      .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .cover svg {
        width: 44px;
        height: 44px;
      }
      /* 播放中封面图标脉冲 */
      .cover.playing svg {
        color: var(--fv-primary);
        animation: fv-pulse 1.6s ease-in-out infinite;
      }
      @keyframes fv-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.12); }
      }
      .audio-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        justify-content: center;
      }
      .audio-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--fv-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .audio-title:empty::after {
        content: '未知音频';
        color: var(--fv-text-dim);
        font-weight: 400;
      }

      /* ---------- 控件条 ---------- */
      .controls {
        flex: none;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.25));
      }
      .audio-controls {
        background: none;
        padding: 0;
      }
      .time {
        flex: none;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--fv-text-dim);
        min-width: 42px;
        text-align: center;
      }
      .progress {
        flex: 1;
        min-width: 40px;
      }
      .volume {
        flex: none;
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .volume fv-slider {
        width: 64px;
      }

      /* 隐藏的 audio 元素（仅作播放载体） */
      audio {
        display: none;
      }

      /* audio 形态媒体占位 */
      .player.audio .media-area {
        display: none;
      }

      /* 倍速文字按钮（图标按钮基础上的尺寸覆盖） */
      .rate-btn {
        min-width: 40px;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      /* 全屏：黑底铺满，视频区自动撑开 */
      .player:fullscreen {
        background: #000;
      }
    `
  ]

  protected willUpdate(changed: Map<string, unknown>) {
    // src / kind 变化：重置播放状态
    if (changed.has('src') || changed.has('kind')) {
      this.resetState()
    }
    // 受控属性同步到媒体元素
    if (this.media) {
      if (changed.has('loop')) this.media.loop = this.loop
      if (changed.has('muted')) this.media.muted = this.muted
      if (changed.has('crossorigin')) {
        if (this.crossorigin) this.media.setAttribute('crossorigin', this.crossorigin)
        else this.media.removeAttribute('crossorigin')
      }
    }
  }

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('fullscreenchange', this.onFsChange)
  }

  disconnectedCallback() {
    document.removeEventListener('fullscreenchange', this.onFsChange)
    super.disconnectedCallback()
  }

  private resetState() {
    this.playing = false
    this.duration = 0
    this.currentTime = 0
    this.previewTime = null
    this.loading = true
    this.errorMsg = null
    this.bufferedRatio = 0
    this.rate = 1
    if (this.media) this.media.playbackRate = 1
  }

  protected firstUpdated() {
    const m = this.media
    if (!m) return
    m.loop = this.loop
    m.muted = this.muted
    if (this.crossorigin) m.setAttribute('crossorigin', this.crossorigin)
    // 浏览器 autoplay 策略：自动播放必须静音
    if (this.autoplay && !this.muted) {
      m.muted = true
      this.isMuted = true
    }
  }

  /* ---------- 对外命令式方法（由外层薄壳转发） ---------- */

  async play(): Promise<void> {
    if (!this.errorMsg) return this.media?.play()
  }
  pause(): void {
    this.media?.pause()
  }
  seek(time: number): void {
    if (!this.media || !Number.isFinite(this.duration) || this.duration <= 0) return
    const t = clamp(time, 0, this.duration)
    this.media.currentTime = t
    this.currentTime = t
    this.emitSeek(t)
  }
  setVolume(v: number): void {
    if (!this.media) return
    const nv = clamp(v, 0, 1)
    this.media.volume = nv
    if (nv > 0 && this.media.muted) this.media.muted = false
  }
  /** 快进（正数）/ 快退（负数），单位秒 */
  skip(delta: number): void {
    if (!this.media || this.errorMsg || !Number.isFinite(delta) || delta === 0) return
    this.seek(this.media.currentTime + delta)
  }
  /** 设置倍速（0.25 ~ 4，超出范围会被截断） */
  setRate(rate: number): void {
    const r = clamp(rate, 0.25, 4)
    this.rate = r
    if (this.media) this.media.playbackRate = r
    const detail: FvRateDetail = { rate: r }
    emit(this, 'ratechange', detail)
  }
  getMediaElement(): HTMLMediaElement | undefined {
    return this.media
  }
  reload(): void {
    this.resetState()
    this.media?.load()
  }

  /* ---------- 媒体事件 ---------- */

  private onLoadedMetadata() {
    this.loading = false
    this.duration = this.media.duration
    const detail: FvLoadDetail = {
      type: this.kind === 'video' ? 'video' : 'audio',
      duration: this.media.duration
    }
    emit(this, 'load', detail)
  }

  private onTimeUpdate() {
    if (this.previewTime !== null) return // 拖动中不回写
    const now = performance.now()
    this.currentTime = this.media.currentTime
    if (now - this.lastTimeupdateAt >= TIMEUPDATE_THROTTLE) {
      this.lastTimeupdateAt = now
      this.emitTimeupdate()
    }
  }

  private emitTimeupdate() {
    const detail: FvTimeupdateDetail = { currentTime: this.currentTime, duration: this.duration }
    emit(this, 'timeupdate', detail)
  }

  private emitSeek(time: number) {
    const detail: FvSeekDetail = { time }
    emit(this, 'seek', detail)
    this.emitTimeupdate()
  }

  private onPlay() {
    this.playing = true
    emit(this, 'play', { type: this.kind })
  }
  private onPause() {
    this.playing = false
    emit(this, 'pause', { type: this.kind })
  }
  private onEnded() {
    this.playing = false
    emit(this, 'ended', { type: this.kind })
  }
  private onVolumeChange() {
    this.volume = this.media.volume
    this.isMuted = this.media.muted
    if (!this.media.muted && this.media.volume > 0) this.lastVolume = this.media.volume
    const detail: FvVolumeDetail = { volume: this.volume, muted: this.isMuted }
    emit(this, 'volumechange', detail)
  }
  private onWaiting() {
    this.loading = true
  }
  private onPlaying() {
    this.loading = false
  }
  private onProgress() {
    const m = this.media
    if (m && m.buffered.length && Number.isFinite(m.duration) && m.duration > 0) {
      this.bufferedRatio = m.buffered.end(m.buffered.length - 1) / m.duration
    }
  }
  private onError() {
    const code = this.media?.error?.code
    const map: Record<number, string> = {
      1: '加载被中断',
      2: '网络错误',
      3: '解码失败',
      4: '资源不存在或格式不支持'
    }
    this.fail((code != null && map[code]) || '媒体加载失败')
  }

  private fail(message: string) {
    this.loading = false
    this.playing = false
    this.errorMsg = message
    const detail: FvErrorDetail = { code: 'load-failed', message }
    emit(this, 'error', detail)
  }

  /* ---------- 控件交互 ---------- */

  private togglePlay() {
    if (!this.media || this.errorMsg) return
    if (this.playing) this.pause()
    else void this.play()
  }

  private onProgressInput(e: CustomEvent<number>) {
    if (!Number.isFinite(this.duration) || this.duration <= 0) return
    this.previewTime = e.detail * this.duration
  }

  private onProgressChange(e: CustomEvent<number>) {
    this.previewTime = null
    this.seek(e.detail * this.duration)
  }

  private onVolumeInput(e: CustomEvent<number>) {
    this.setVolume(e.detail)
  }

  private toggleMute() {
    if (!this.media) return
    if (this.media.muted || this.media.volume === 0) {
      this.media.muted = false
      if (this.media.volume === 0) this.media.volume = this.lastVolume || 1
    } else {
      this.media.muted = true
    }
  }

  private toggleLoop() {
    this.loop = !this.loop
    if (this.media) this.media.loop = this.loop
  }

  private onRetry() {
    this.reload()
  }

  /** 倍速按钮：档位循环切换（0.5 → 0.75 → 1 → 1.25 → 1.5 → 2 → 0.5） */
  private cycleRate(): void {
    const idx = RATES.indexOf(this.rate as (typeof RATES)[number])
    this.setRate(RATES[(idx + 1 + RATES.length) % RATES.length])
  }

  /** 全屏切换（仅视频形态显示按钮） */
  private toggleFullscreen(): void {
    const host = this.playerRoot
    if (!host) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void host.requestFullscreen?.()
  }

  /** document fullscreenchange 监听（connectedCallback 绑定） */
  private onFsChange = (): void => {
    this.isFullscreen = !!document.fullscreenElement
    const detail: FvFullscreenDetail = { fullscreen: this.isFullscreen }
    emit(this, 'fullscreenchange', detail)
  }

  /** 解析控件配置：对象 = 覆盖默认值；数组 = 白名单（仅保留所列控件） */
  private get ctl(): Required<FvPlayerControls> {
    const defaults: Required<FvPlayerControls> = {
      skip: 10,
      rate: true,
      volume: true,
      loop: true,
      fullscreen: true,
      progress: true
    }
    let raw: unknown = this.controls
    if (!raw) return defaults
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw)
      } catch {
        return defaults
      }
    }
    if (Array.isArray(raw)) {
      const list = raw as string[]
      return {
        skip: list.includes('skip') ? 10 : false,
        rate: list.includes('rate'),
        volume: list.includes('volume'),
        loop: list.includes('loop'),
        fullscreen: list.includes('fullscreen'),
        progress: list.includes('progress')
      }
    }
    if (typeof raw === 'object' && raw !== null) {
      const merged = { ...defaults, ...(raw as FvPlayerControls) }
      // skip 规范化：true → 10；false / 非法值处理
      const skip =
        merged.skip === true
          ? 10
          : merged.skip === false
            ? false
            : typeof merged.skip === 'number' && merged.skip > 0
              ? merged.skip
              : 10
      return { ...merged, skip }
    }
    return defaults
  }

  /* ---------- 渲染 ---------- */

  private get durationReady(): boolean {
    return Number.isFinite(this.duration) && this.duration > 0
  }

  private get progressRatio(): number {
    if (!this.durationReady) return 0
    return clamp((this.previewTime ?? this.currentTime) / this.duration, 0, 1)
  }

  private get displayTime(): number {
    return this.previewTime ?? this.currentTime
  }

  private get volumeIcon() {
    if (this.isMuted || this.volume === 0) return ICON_VOL_MUTE
    if (this.volume < 0.5) return ICON_VOL_LOW
    return ICON_VOL_HIGH
  }

  protected render() {
    const isVideo = this.kind === 'video'
    // 用固定二选一的模板渲染媒体元素，避免动态标签
    const mediaEl = isVideo
      ? html`<video
          part="media"
          .src=${this.src}
          .poster=${this.poster || undefined}
          preload=${this.preload}
          ?autoplay=${this.autoplay}
          @click=${this.togglePlay}
          @loadedmetadata=${this.onLoadedMetadata}
          @timeupdate=${this.onTimeUpdate}
          @play=${this.onPlay}
          @pause=${this.onPause}
          @ended=${this.onEnded}
          @volumechange=${this.onVolumeChange}
          @waiting=${this.onWaiting}
          @playing=${this.onPlaying}
          @canplay=${this.onPlaying}
          @progress=${this.onProgress}
          @error=${this.onError}
        ></video>`
      : html`<audio
          part="media"
          .src=${this.src}
          preload=${this.preload}
          ?autoplay=${this.autoplay}
          @loadedmetadata=${this.onLoadedMetadata}
          @timeupdate=${this.onTimeUpdate}
          @play=${this.onPlay}
          @pause=${this.onPause}
          @ended=${this.onEnded}
          @volumechange=${this.onVolumeChange}
          @waiting=${this.onWaiting}
          @playing=${this.onPlaying}
          @canplay=${this.onPlaying}
          @progress=${this.onProgress}
          @error=${this.onError}
        ></audio>`

    // 控件配置（ctl getter 解析，每次 render 取一次）
    const c = this.ctl
    // skip：正数 = 快退/快进步长秒；false / 非法 = 0（不渲染按钮）
    const skipSec: number = typeof c.skip === 'number' && c.skip > 0 ? c.skip : 0
    const rateLabel = `${this.rate}x`

    const controls = html`
      <div class="controls ${isVideo ? '' : 'audio-controls'}" part="toolbar">
        ${skipSec > 0
          ? html`<button class="fv-btn" @click=${() => this.skip(-skipSec)} aria-label="快退 ${skipSec} 秒" title="快退 ${skipSec} 秒">
              ${ICON_SKIP_BACK}
            </button>`
          : nothing}
        <button class="fv-btn" part="control-button" @click=${this.togglePlay} aria-label=${this.playing ? '暂停' : '播放'}>
          ${this.playing ? ICON_PAUSE : ICON_PLAY}
        </button>
        ${skipSec > 0
          ? html`<button class="fv-btn" @click=${() => this.skip(skipSec)} aria-label="快进 ${skipSec} 秒" title="快进 ${skipSec} 秒">
              ${ICON_SKIP_FWD}
            </button>`
          : nothing}
        <span class="time" part="time-label">${formatTime(this.displayTime)}</span>
        ${c.progress
          ? html`<fv-slider
              class="progress"
              part="progress"
              .value=${this.progressRatio}
              .buffered=${this.bufferedRatio}
              .disabled=${!this.durationReady}
              @input=${this.onProgressInput}
              @change=${this.onProgressChange}
            ></fv-slider>`
          : nothing}
        <span class="time">${this.durationReady ? formatTime(this.duration) : '--:--'}</span>
        ${c.volume
          ? html`<div class="volume" part="volume">
              <button class="fv-btn" @click=${this.toggleMute} aria-label=${this.isMuted ? '取消静音' : '静音'}>
                ${this.volumeIcon}
              </button>
              <fv-slider .value=${this.isMuted ? 0 : this.volume} @input=${this.onVolumeInput}></fv-slider>
            </div>`
          : nothing}
        ${c.rate
          ? html`<button class="fv-btn rate-btn" part="rate-button" @click=${this.cycleRate} aria-label="倍速" title="倍速（0.5x ~ 2x）">
              ${rateLabel}
            </button>`
          : nothing}
        ${c.loop
          ? html`<button
              class="fv-btn ${this.loop ? 'active' : ''}"
              @click=${this.toggleLoop}
              aria-label="循环播放"
              title="循环播放"
            >
              ${ICON_LOOP}
            </button>`
          : nothing}
        ${isVideo && c.fullscreen
          ? html`<button
              class="fv-btn"
              @click=${this.toggleFullscreen}
              aria-label=${this.isFullscreen ? '退出全屏' : '全屏'}
              title=${this.isFullscreen ? '退出全屏' : '全屏'}
            >
              ${this.isFullscreen ? ICON_FULL_EXIT : ICON_FULL}
            </button>`
          : nothing}
      </div>
    `

    return html`
      <div class="player ${isVideo ? '' : 'audio'}">
        ${isVideo
          ? html`
              <div class="media-area">
                ${mediaEl}
                ${!this.playing && !this.loading && !this.errorMsg
                  ? html`<button class="big-play" @click=${this.togglePlay} aria-label="播放">${ICON_PLAY}</button>`
                  : nothing}
                ${this.loading && !this.errorMsg
                  ? html`<div class="fv-loading"><slot name="loading"><div class="fv-spinner"></div></slot></div>`
                  : nothing}
              </div>
              ${controls}
            `
          : html`
              ${mediaEl}
              <div class="audio-body">
                <div class="cover ${this.playing ? 'playing' : ''}" part="cover">
                  ${this.poster ? html`<img src=${this.poster} alt="封面" @error=${(e: Event) => (e.target as HTMLImageElement).remove()} />` : ICON_MUSIC}
                </div>
                <div class="audio-main">
                  <div class="audio-title" title=${this.name}>${this.name}</div>
                  ${controls}
                </div>
              </div>
              ${this.loading && !this.errorMsg
                ? html`<div class="fv-loading"><slot name="loading"><div class="fv-spinner"></div></slot></div>`
                : nothing}
            `}
        ${this.errorMsg
          ? html`
              <div class="fv-error" part="error-box">
                <slot name="error">
                  ${ICON_ERROR}
                  <div class="fv-error-msg">${this.errorMsg}</div>
                  <button class="fv-retry" @click=${this.onRetry}>${ICON_RETRY} 重试</button>
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
    'file-preview-player': FilePreviewPlayer
  }
}
