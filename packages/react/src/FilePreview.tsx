import { createElement, forwardRef, useEffect, useRef } from 'react'
import type { MutableRefObject, CSSProperties } from 'react'
import type {
  FvActionDetail,
  FvActionItem,
  FvDownloadDetail,
  FvErrorDetail,
  FvFullscreenDetail,
  FvLoadDetail,
  FvPageDetail,
  FvPlayerControls,
  FvRateDetail,
  FvRotateDetail,
  FvSeekDetail,
  FvTimeupdateDetail,
  FvVolumeDetail,
  FvWatermarkOptions,
  FvZoomDetail,
  FilePreview as FilePreviewElement,
  TypeAttr
} from '@allfile-preview/core'

export interface FilePreviewProps {
  /** 文件地址 */
  src?: string
  /** 媒体类型，默认 auto 自动检测 */
  type?: TypeAttr
  /** 文件名（audio 模式下作为标题） */
  name?: string
  /** MIME 提示 */
  mime?: string
  /** 视频 / 音频封面 */
  poster?: string
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  preload?: string
  crossorigin?: string
  /** 主题色 */
  color?: string
  /** pdfjs cMaps 目录（中文等非嵌入字体 PDF 需要） */
  cMapUrl?: string
  /** 显示下载按钮（操作栏） */
  downloadable?: boolean
  /** 操作栏自定义按钮配置（JSON 字符串或数组） */
  actions?: string | FvActionItem[]
  /** 播放器控件配置（JSON 字符串 / 对象覆盖式 / 数组白名单，仅 video / audio 生效） */
  controls?: string | FvPlayerControls | readonly string[]
  /** 水印配置（JSON 字符串 / 对象直传，所有预览类型生效）：{ text, image, width, height, fontSize, color, opacity, rotate, gap } */
  watermark?: string | FvWatermarkOptions
  className?: string
  style?: CSSProperties

  // ---- 事件（对应 core 的 CustomEvent，参数为 event.detail）----
  onLoad?: (detail: FvLoadDetail) => void
  onError?: (detail: FvErrorDetail) => void
  onZoom?: (detail: FvZoomDetail) => void
  onRotate?: (detail: FvRotateDetail) => void
  onReset?: () => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onTimeupdate?: (detail: FvTimeupdateDetail) => void
  onSeek?: (detail: FvSeekDetail) => void
  onVolumechange?: (detail: FvVolumeDetail) => void
  onRatechange?: (detail: FvRateDetail) => void
  onFullscreenchange?: (detail: FvFullscreenDetail) => void
  onPagechange?: (detail: FvPageDetail) => void
  onDownload?: (detail: FvDownloadDetail) => void
  onAction?: (detail: FvActionDetail) => void
}

/** 属性默认值（变化时同步回默认，避免残留） */
const PROP_DEFAULTS: Record<string, unknown> = {
  src: '',
  type: 'auto',
  name: '',
  mime: '',
  poster: '',
  autoplay: false,
  muted: false,
  loop: false,
  preload: 'metadata',
  crossorigin: '',
  color: '',
  cMapUrl: '',
  downloadable: false,
  actions: '',
  controls: '',
  watermark: ''
}

/** CustomEvent 事件名 → props 回调名 映射 */
const EVENT_MAP: ReadonlyArray<readonly [string, keyof FilePreviewProps]> = [
  ['load', 'onLoad'],
  ['error', 'onError'],
  ['zoom', 'onZoom'],
  ['rotate', 'onRotate'],
  ['reset', 'onReset'],
  ['play', 'onPlay'],
  ['pause', 'onPause'],
  ['ended', 'onEnded'],
  ['timeupdate', 'onTimeupdate'],
  ['seek', 'onSeek'],
  ['volumechange', 'onVolumechange'],
  ['ratechange', 'onRatechange'],
  ['fullscreenchange', 'onFullscreenchange'],
  ['pagechange', 'onPagechange'],
  ['download', 'onDownload'],
  ['action', 'onAction']
]

/**
 * React 封装组件。
 *
 * React ≤18 无法声明式绑定自定义元素事件，本组件内部通过
 * ref + addEventListener 桥接；属性以 DOM property 方式赋值，
 * 与 Lit 响应式属性语义一致。
 *
 * <FilePreview src="a.png" onError={fn} ref={elRef} />
 */
export const FilePreview = forwardRef<FilePreviewElement, FilePreviewProps>(function FilePreview(
  props,
  ref
) {
  const innerRef = useRef<FilePreviewElement | null>(null)

  // 合并外部 ref 与内部 ref
  const setRef = (el: FilePreviewElement | null) => {
    innerRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as MutableRefObject<FilePreviewElement | null>).current = el
  }

  // 保存最新的事件回调（避免 useEffect 闭包过期）
  const handlersRef = useRef<Pick<FilePreviewProps, keyof FilePreviewProps>>({} as never)
  handlersRef.current = props

  // 属性同步：每次渲染后以 DOM property 方式全量赋值
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const record = el as unknown as Record<string, unknown>
    for (const key of Object.keys(PROP_DEFAULTS)) {
      const incoming = (props as Record<string, unknown>)[key]
      record[key] = incoming === undefined || incoming === null ? PROP_DEFAULTS[key] : incoming
    }
  })

  // 事件桥接：挂载时绑定一次，卸载时移除
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const bindings = EVENT_MAP.map(([eventName, propName]) => {
      const fn = (e: Event) => {
        const cb = handlersRef.current[propName] as ((detail: unknown) => void) | undefined
        cb?.((e as CustomEvent).detail)
      }
      el.addEventListener(eventName, fn)
      return [eventName, fn] as const
    })
    return () => {
      bindings.forEach(([eventName, fn]) => el.removeEventListener(eventName, fn))
    }
  }, [])

  return createElement('file-preview', {
    ref: setRef,
    className: props.className,
    style: props.style
  })
})
