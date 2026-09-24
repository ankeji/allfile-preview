/**
 * 秒数格式化为可读时间。
 * 小于 1 小时：m:ss；1 小时及以上：h:mm:ss。
 * 无效时长（Infinity/NaN）返回 --:--
 */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--'
  const s = Math.floor(sec % 60)
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}
