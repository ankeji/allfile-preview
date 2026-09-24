import type { MediaType } from './types'

/** 扩展名 → 媒体类型映射表 */
export const EXT_MAP: Record<string, MediaType> = {
  // 图片
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  avif: 'image',
  ico: 'image',
  // 视频
  mp4: 'video',
  webm: 'video',
  ogv: 'video',
  mov: 'video',
  m4v: 'video',
  mkv: 'video',
  // 音频（.ogg 有歧义，默认按音频处理，需要视频时请显式传 type="video"）
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  oga: 'audio',
  m4a: 'audio',
  flac: 'audio',
  aac: 'audio',
  opus: 'audio',
  // PDF
  pdf: 'pdf',
  // 文本
  txt: 'text',
  log: 'text',
  json: 'text',
  xml: 'text',
  csv: 'text',
  ini: 'text',
  conf: 'text',
  yaml: 'text',
  yml: 'text',
  toml: 'text',
  sql: 'text',
  js: 'text',
  mjs: 'text',
  ts: 'text',
  css: 'text',
  scss: 'text',
  less: 'text',
  html: 'text',
  htm: 'text',
  vue: 'text',
  // Markdown（独立渲染组件）
  md: 'markdown',
  markdown: 'markdown',
  // Word（.doc 老二进制格式不支持，仅 .docx）
  docx: 'docx',
  // Excel（.xls / .xlsx 均由 SheetJS 解析）
  xls: 'xlsx',
  xlsx: 'xlsx'
}

/** 图片查看器：最小 / 最大缩放倍数（相对 fit 尺寸） */
export const MIN_SCALE = 0.2
export const MAX_SCALE = 8

/** 每次按钮缩放的步长 */
export const ZOOM_STEP = 1.2

/** timeupdate 事件节流间隔（ms） */
export const TIMEUPDATE_THROTTLE = 250
