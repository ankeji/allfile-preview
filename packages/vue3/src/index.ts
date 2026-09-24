import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import type {
  FvActionDetail,
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
  FilePreview as FilePreviewElement
} from '@allfile-preview/core'

/** 所有对外事件（与 core 的 CustomEvent 一一对应） */
const EVENT_NAMES = [
  'load',
  'error',
  'zoom',
  'rotate',
  'reset',
  'play',
  'pause',
  'ended',
  'timeupdate',
  'seek',
  'volumechange',
  'ratechange',
  'fullscreenchange',
  'pagechange',
  'download',
  'action'
] as const

/** 需要透传到 <file-preview> 的属性 */
const PROP_KEYS = [
  'src',
  'type',
  'name',
  'mime',
  'poster',
  'autoplay',
  'muted',
  'loop',
  'preload',
  'crossorigin',
  'color',
  'cMapUrl',
  'downloadable',
  'actions',
  'controls',
  'watermark'
] as const

/** <FilePreview> 的事件回调类型 */
export interface FilePreviewEmits {
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

/**
 * Vue3 封装组件。
 * 渲染函数内部创建自定义元素，用户侧无需配置 isCustomElement。
 *
 * <FilePreview src="a.png" @zoom="onZoom" />
 */
export const FilePreview = defineComponent({
  name: 'FilePreview',
  props: {
    src: { type: String, default: '' },
    type: {
      type: String as PropType<'image' | 'video' | 'audio' | 'pdf' | 'text' | 'markdown' | 'docx' | 'xlsx' | 'auto'>,
      default: 'auto'
    },
    name: { type: String, default: '' },
    mime: { type: String, default: '' },
    poster: { type: String, default: '' },
    autoplay: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    loop: { type: Boolean, default: false },
    preload: { type: String, default: 'metadata' },
    crossorigin: { type: String, default: '' },
    color: { type: String, default: '' },
    /** pdfjs cMaps 目录（中文等非嵌入字体 PDF 需要） */
    cMapUrl: { type: String, default: '' },
    /** 显示下载按钮（操作栏） */
    downloadable: { type: Boolean, default: false },
    /** 操作栏自定义按钮配置（JSON 字符串或数组直传） */
    actions: { type: [String, Array] as PropType<string | Array<{ key: string; label: string; danger?: boolean }>>, default: '' },
    /** 播放器控件配置（JSON 字符串 / 对象覆盖式 / 数组白名单，仅 video / audio 生效） */
    controls: { type: [String, Object, Array] as PropType<string | FvPlayerControls | readonly string[]>, default: '' },
    /** 水印配置（JSON 字符串 / 对象直传，所有预览类型生效）：{ text, image, width, height, fontSize, color, opacity, rotate, gap } */
    watermark: { type: [String, Object] as PropType<string | FvWatermarkOptions>, default: '' }
  },
  emits: [...EVENT_NAMES],
  setup(props, { emit, expose, attrs }) {
    const el = ref<FilePreviewElement | null>(null)

    // 事件桥接：CustomEvent(detail) → Vue emit
    const listeners = EVENT_NAMES.map((name) => {
      const fn = (e: Event) => emit(name, (e as CustomEvent).detail)
      return [name, fn] as const
    })

    onMounted(() => {
      listeners.forEach(([name, fn]) => el.value?.addEventListener(name, fn))
    })
    onBeforeUnmount(() => {
      listeners.forEach(([name, fn]) => el.value?.removeEventListener(name, fn))
    })

    // 暴露命令式方法（转发到内部元素）
    const method = (name: string) => (...args: unknown[]) => {
      const target = el.value as unknown as Record<string, ((...a: unknown[]) => unknown) | undefined>
      return target?.[name]?.(...args)
    }

    expose({
      /** 内部 <file-preview> 元素 */
      el,
      reset: method('reset'),
      zoomTo: method('zoomTo'),
      zoomBy: method('zoomBy'),
      rotateTo: method('rotateTo'),
      rotateBy: method('rotateBy'),
      play: method('play'),
      pause: method('pause'),
      seek: method('seek'),
      setVolume: method('setVolume'),
      skip: method('skip'),
      setRate: method('setRate'),
      goToPage: method('goToPage'),
      nextPage: method('nextPage'),
      prevPage: method('prevPage'),
      getMediaElement: method('getMediaElement'),
      reload: method('reload')
    })

    return () => {
      // 属性透传：Vue3 对自定义元素优先设置 DOM property，与 Lit 响应式属性契合
      const domProps: Record<string, unknown> = {}
      for (const key of PROP_KEYS) domProps[key] = props[key]
      return h('file-preview', { ref: el, ...domProps, ...attrs })
    }
  }
})

export default FilePreview
