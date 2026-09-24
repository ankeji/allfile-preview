/** 备选解码编码（按序尝试） */
const FALLBACK_ENCODINGS = ['gb18030', 'big5', 'latin1']

/**
 * 解码文本：优先严格 UTF-8，失败后按备选编码尝试（中文 Windows 场景 GBK 常见）
 */
export function decodeText(buf: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buf)
  // 去掉 UTF-8 BOM
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const data = hasBom ? bytes.subarray(3) : bytes
  if (hasBom) return { text: new TextDecoder('utf-8').decode(data), encoding: 'utf-8' }

  try {
    // fatal: true —— 非法 UTF-8 序列直接抛错
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(data), encoding: 'utf-8' }
  } catch {
    for (const enc of FALLBACK_ENCODINGS) {
      try {
        return { text: new TextDecoder(enc).decode(data), encoding: enc }
      } catch {
        /* 该编码不被浏览器支持，尝试下一个 */
      }
    }
  }
  return { text: new TextDecoder('utf-8').decode(data), encoding: 'utf-8' }
}
