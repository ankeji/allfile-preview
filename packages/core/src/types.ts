/** 支持的媒体类型 */
export type MediaType =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'markdown'
  | 'docx'
  | 'xlsx'

/** type 属性的可取值（auto 表示自动检测） */
export type TypeAttr = MediaType | 'auto'

/** load 事件 detail */
export interface FvLoadDetail {
  type: MediaType
  /** 图片原始宽度 */
  width?: number
  /** 图片原始高度 */
  height?: number
  /** 媒体总时长（秒） */
  duration?: number
  /** PDF 总页数 */
  pages?: number
  /** 文本编码（text 类型） */
  encoding?: string
  /** 工作表数量（xlsx 类型） */
  sheets?: number
}

/** error 事件 detail */
export interface FvErrorDetail {
  /** load-failed：加载失败；unsupported-type：无法识别文件类型 */
  code: 'load-failed' | 'unsupported-type'
  message: string
}

/** zoom 事件 detail */
export interface FvZoomDetail {
  /** 相对 fit 尺寸的缩放倍数，1 表示刚好适应容器 */
  scale: number
}

/** rotate 事件 detail */
export interface FvRotateDetail {
  /** 旋转角度（度） */
  angle: number
}

/** timeupdate 事件 detail（约 250ms 节流一次） */
export interface FvTimeupdateDetail {
  currentTime: number
  duration: number
}

/** seek 事件 detail */
export interface FvSeekDetail {
  time: number
}

/** volumechange 事件 detail */
export interface FvVolumeDetail {
  volume: number
  muted: boolean
}

/** pagechange 事件 detail（pdf） */
export interface FvPageDetail {
  page: number
  pages: number
}

/** 操作栏按钮配置（actions 属性的 JSON 项） */
export interface FvActionItem {
  /** 按钮标识，点击时随 action 事件原样返回 */
  key: string
  /** 按钮文字 */
  label: string
  /** 危险操作样式（红色，如删除） */
  danger?: boolean
}

/** action 事件 detail（用户点击 actions 配置的自定义按钮） */
export interface FvActionDetail {
  /** 对应 actions 配置项的 key */
  key: string
  /** 当前预览文件信息（可用于调用删除等业务接口） */
  src: string
  name: string
  type: MediaType | null
}

/** download 事件 detail */
export interface FvDownloadDetail {
  /** 下载使用的文件名 */
  filename: string
  /** 文件原始地址 */
  src: string
  /** true = 跨域 fetch 失败，已回退为浏览器直接打开原地址 */
  fallback: boolean
}

/**
 * 播放器控件配置（controls 属性的 JSON 项，仅 video / audio 类型生效）
 *
 * - 对象形式：覆盖式，仅出现的项生效，未出现的用默认值
 * - 数组形式：白名单，仅保留所列控件（'skip' | 'rate' | 'volume' | 'loop' | 'fullscreen' | 'progress'）
 * - 缺省：默认全部显示
 */
export interface FvPlayerControls {
  /** 快退/快进按钮：number = 步长秒数（默认 10）；false = 隐藏 */
  skip?: number | boolean
  /** 倍速按钮（0.5x ~ 2x 循环切换），默认显示 */
  rate?: boolean
  /** 音量按钮 + 音量条，默认显示 */
  volume?: boolean
  /** 循环开关按钮，默认显示 */
  loop?: boolean
  /** 全屏按钮（仅视频形态有效），默认显示 */
  fullscreen?: boolean
  /** 进度条，默认显示 */
  progress?: boolean
}

/** ratechange 事件 detail（播放器倍速切换） */
export interface FvRateDetail {
  /** 当前倍速（0.25 ~ 4） */
  rate: number
}

/**
 * 水印配置（watermark 属性的 JSON 项，所有预览类型生效）
 *
 * text 与 image 二选一，同时配置时 image 优先；两者都缺省则不显示水印。
 * 单个水印平铺整个预览区（canvas 生成平铺图案，pointer-events:none 不影响交互）。
 */
export interface FvWatermarkOptions {
  /** 文字水印内容 */
  text?: string
  /** 图片水印地址（http / blob / data URL；跨域图片需服务端允许 CORS，否则不显示） */
  image?: string
  /** 单个水印宽度 px（缺省：文字按内容自适应，图片按原始宽度） */
  width?: number
  /** 单个水印高度 px（缺省：文字按字号自适应，图片按 width 等比缩放） */
  height?: number
  /** 文字大小 px（默认 16，仅文字水印生效） */
  fontSize?: number
  /** 文字颜色（默认 #94a3b8，深浅背景均可见） */
  color?: string
  /** 整体透明度 0~1（默认 0.35，文字与图片均生效） */
  opacity?: number
  /** 旋转角度（默认 -22，单位度，顺时针为正） */
  rotate?: number
  /** 相邻水印间距 px（默认 100） */
  gap?: number
}

/** fullscreenchange 事件 detail（视频全屏状态变化，仅视频形态） */
export interface FvFullscreenDetail {
  /** 是否处于全屏 */
  fullscreen: boolean
}
