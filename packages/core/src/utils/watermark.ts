import type { FvWatermarkOptions } from '../types'

/** 生成结果：平铺图案 URL（data URL）与单个平铺单元尺寸 */
export interface WatermarkTile {
  url: string
  width: number
  height: number
}

/** 水印默认配置 */
const DEFAULTS = {
  fontSize: 16,
  color: '#94a3b8',
  opacity: 0.35,
  rotate: -22,
  gap: 100
}

/** 文字字体栈（与组件宿主页面字体一致，含中文字体兜底） */
const FONT_STACK = `system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`

/** 加载图片（crossOrigin=anonymous：跨域图片需服务端允许 CORS，否则 canvas 会被污染） */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`水印图片加载失败：${src}`))
    img.src = src
  })
}

/**
 * 生成平铺水印图案：把单个水印（文字或图片）绘制到带间距的 canvas 单元上，
 * 输出 data URL 供 background-image 平铺。文字与图片二选一，image 优先。
 * 返回 null 表示无法生成（未配置内容 / 图片加载失败 / 跨域污染 canvas）。
 */
export async function buildWatermarkTile(raw: FvWatermarkOptions): Promise<WatermarkTile | null> {
  const opts = { ...DEFAULTS, ...raw }

  try {
    if (opts.image) {
      const img = await loadImage(opts.image)
      // 绘制尺寸：默认图片原始尺寸；只指定 width 时等比缩放
      const nw = img.naturalWidth || 200
      const nh = img.naturalHeight || 150
      const w = opts.width ?? nw
      const h = opts.height ?? (opts.width ? Math.round((nh * w) / nw) : nh)
      return drawTile(w, h, opts, (ctx) => ctx.drawImage(img, -w / 2, -h / 2, w, h))
    }

    if (opts.text) {
      const text = opts.text // 提取为常量：闭包内属性收窄会失效
      // 先量文字尺寸（画布外测量），默认块尺寸 = 文字宽高 + 内边距
      const probe = document.createElement('canvas').getContext('2d')!
      probe.font = `${opts.fontSize}px ${FONT_STACK}`
      const textW = Math.ceil(probe.measureText(text).width)
      const w = opts.width ?? textW + 16
      const h = opts.height ?? Math.ceil(opts.fontSize * 1.6)
      return drawTile(w, h, opts, (ctx) => {
        ctx.fillStyle = opts.color
        ctx.font = `${opts.fontSize}px ${FONT_STACK}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 0, 0)
      })
    }
  } catch (err) {
    // 图片加载失败 / canvas 跨域污染（toDataURL 抛 SecurityError）
    console.warn('[file-preview] 水印生成失败：', err)
    return null
  }

  return null
}

/**
 * 绘制单个平铺单元：尺寸取内容旋转后的包围盒 + 间距，内容居中旋转绘制。
 * toDataURL 可能因跨域图片污染 canvas 抛异常，由调用方捕获。
 */
function drawTile(
  w: number,
  h: number,
  opts: typeof DEFAULTS & FvWatermarkOptions,
  draw: (ctx: CanvasRenderingContext2D) => void
): WatermarkTile {
  const rad = (opts.rotate * Math.PI) / 180
  // 旋转后的包围盒（避免相邻单元内容被裁切）
  const boxW = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) + opts.gap
  const boxH = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))) + opts.gap

  const canvas = document.createElement('canvas')
  canvas.width = boxW
  canvas.height = boxH
  const ctx = canvas.getContext('2d')!
  ctx.globalAlpha = opts.opacity
  ctx.translate(boxW / 2, boxH / 2)
  ctx.rotate(rad)
  draw(ctx)

  return { url: canvas.toDataURL('image/png'), width: boxW, height: boxH }
}
