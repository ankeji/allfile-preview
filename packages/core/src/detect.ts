import { EXT_MAP } from './constants'
import type { MediaType } from './types'

/** 从 MIME 字符串解析媒体类型 */
export function mimeToType(mime: string): MediaType | null {
  const m = (mime || '').trim().toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m === 'application/pdf') return 'pdf'
  if (m === 'text/markdown' || m === 'text/x-markdown') return 'markdown'
  if (m.startsWith('text/')) return 'text'
  // docx
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  // xlsx / xls
  if (
    m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    m === 'application/vnd.ms-excel'
  ) {
    return 'xlsx'
  }
  return null
}

/** 提取路径的扩展名（不含点，小写；无扩展名返回空串） */
function extOf(pathname: string): string {
  const idx = pathname.lastIndexOf('.')
  // 排除以点开头的隐藏文件名（如 /a/.env）
  if (idx <= 0 || idx === pathname.length - 1) return ''
  return pathname.slice(idx + 1).toLowerCase()
}

/**
 * 同步类型检测（优先级：name 扩展名 > URL 扩展名 > data: URL 的 mime）
 * 检测不出返回 null（调用方可再走 HEAD 异步探测）。
 */
export function detectType(src: string, name = '', mime = ''): MediaType | null {
  // 显式 mime 提示
  const byMime = mimeToType(mime)
  if (byMime) return byMime

  // data: URL 可直接解析出 mime（data:image/png;base64,...）
  if (/^data:/i.test(src)) {
    const m = src.slice(5, src.indexOf(','))
    const fromData = mimeToType(m)
    if (fromData) return fromData
  }

  // 文件名扩展名优先（覆盖 URL 无扩展名、blob URL 等场景）
  if (name) {
    const t = EXT_MAP[extOf(name)]
    if (t) return t
  }

  // URL 扩展名（剥离 query/hash）
  try {
    const u = new URL(src, (typeof location !== 'undefined' && location.href) || 'http://localhost/')
    const t = EXT_MAP[extOf(u.pathname)]
    if (t) return t
  } catch {
    /* 非法 URL 忽略 */
  }

  return null
}

/**
 * 异步兜底：HEAD 请求读 Content-Type。
 * file:// 协议或跨域被拒时返回 null（静默失败）。
 */
export async function detectTypeByHead(src: string): Promise<MediaType | null> {
  if (!src || /^data:/i.test(src)) return null
  try {
    const res = await fetch(src, { method: 'HEAD' })
    return mimeToType(res.headers.get('content-type') || '')
  } catch {
    return null
  }
}
