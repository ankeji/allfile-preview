// 引入即注册所有自定义元素（副作用）
import '@allfile-preview/core'
import { MEDIA } from '../../shared/media'

/* ---------- 小工具：向日志区追加一行 ---------- */
function bindLog(id: string, events: string[]) {
  const el = document.getElementById(id)!
  const target = document.getElementById(id.replace('-log', '-preview'))!
  events.forEach((name) => {
    target.addEventListener(name, (e) => {
      const detail = (e as CustomEvent).detail
      const text = detail === undefined || Object.keys(detail as object).length === 0
        ? ''
        : ' ' + JSON.stringify(detail)
      el.textContent += `\n[${name}]${text}`
      el.scrollTop = el.scrollHeight
    })
  })
}

bindLog('img-log', ['load', 'error', 'zoom', 'rotate', 'reset', 'download'])
bindLog('video-log', ['load', 'error', 'play', 'pause', 'timeupdate', 'seek', 'volumechange', 'ratechange', 'fullscreenchange', 'ended', 'download'])
bindLog('audio-log', ['load', 'error', 'play', 'pause', 'seek', 'volumechange', 'ratechange', 'download'])
bindLog('doc-log', ['load', 'error', 'pagechange', 'zoom', 'download'])

/* ---------- 文档：操作栏自定义按钮（action 事件 → 取文件信息调用业务接口） ---------- */
const docLog = document.getElementById('doc-log')!
document.getElementById('doc-preview')!.addEventListener('action', (e) => {
  const detail = (e as CustomEvent).detail as { key: string; src: string; name: string; type: string }
  docLog.textContent += `\n[action] ${JSON.stringify(detail)}`
  docLog.scrollTop = docLog.scrollHeight
  if (detail.key === 'delete') {
    // 这里拿 detail.src / detail.name / detail.type 调用删除接口
    if (confirm(`确认删除「${detail.name}」？（demo 模拟接口调用）`)) {
      console.log('[模拟删除接口] payload =', detail)
      docLog.textContent += `\n[delete] 已调用删除接口（模拟）：${detail.name}`
      docLog.scrollTop = docLog.scrollHeight
    }
  }
})

/* ---------- 图片：切换 src ---------- */
const imgPreview = document.getElementById('img-preview')!
const imgMap: Record<string, string> = {
  local: MEDIA.image.local,
  remote: MEDIA.image.remote,
  broken: MEDIA.image.broken
}
document.querySelectorAll<HTMLButtonElement>('[data-img]').forEach((btn) => {
  btn.addEventListener('click', () => {
    imgPreview.setAttribute('src', imgMap[btn.dataset.img!])
  })
})

/* ---------- 图片：命令式 API ---------- */
document.getElementById('btn-api')!.addEventListener('click', () => {
  const el = imgPreview as unknown as {
    zoomTo: (s: number) => void
    rotateBy: (d: number) => void
  }
  el.zoomTo(2)
  el.rotateBy(90)
})

/* ---------- 视频：切换 src ---------- */
const videoPreview = document.getElementById('video-preview')!
videoPreview.setAttribute('src', MEDIA.video.remote)
const videoMap: Record<string, string> = {
  remote: MEDIA.video.remote,
  broken: MEDIA.video.broken
}
document.querySelectorAll<HTMLButtonElement>('[data-vid]').forEach((btn) => {
  btn.addEventListener('click', () => {
    videoPreview.setAttribute('src', videoMap[btn.dataset.vid!])
  })
})

/* ---------- 视频：控件配置切换（controls 属性：对象覆盖式 / 数组白名单） ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-ctl]').forEach((btn) => {
  btn.addEventListener('click', () => {
    // 完整 = 默认全开（空值即可）；极简 = 白名单只留进度条（play 与时间显示恒显）
    videoPreview.setAttribute('controls', btn.dataset.ctl === 'mini' ? '["progress"]' : '')
  })
})

/* ---------- 音频：切换 src ---------- */
const audioPreview = document.getElementById('audio-preview')!
const audioMap: Record<string, string> = {
  local: MEDIA.audio.local,
  remote: MEDIA.audio.remote
}
document.querySelectorAll<HTMLButtonElement>('[data-aud]').forEach((btn) => {
  btn.addEventListener('click', () => {
    audioPreview.setAttribute('src', audioMap[btn.dataset.aud!])
    audioPreview.setAttribute('name', btn.dataset.aud === 'local' ? 'C 大调琶音 · tone.wav' : 'SoundHelix Song 1 · mp3')
  })
})

/* ---------- 文档：类型切换 ---------- */
const docPreview = document.getElementById('doc-preview')!
const docMap: Record<string, { src: string; type: string; name: string }> = {
  pdf: { src: MEDIA.pdf.local, type: 'pdf', name: 'sample.pdf' },
  text: { src: MEDIA.text.local, type: 'text', name: 'sample.txt' },
  markdown: { src: MEDIA.markdown.local, type: 'markdown', name: 'sample.md' },
  docx: { src: MEDIA.docx.local, type: 'docx', name: 'sample.docx' },
  xlsx: { src: MEDIA.xlsx.local, type: 'xlsx', name: 'sample.xlsx' },
  broken: { src: '/media/not-exist.pdf', type: 'pdf', name: 'not-exist.pdf' }
}
document.querySelectorAll<HTMLButtonElement>('[data-doc]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = docMap[btn.dataset.doc!]
    docPreview.setAttribute('type', item.type)
    docPreview.setAttribute('name', item.name)
    docPreview.setAttribute('src', item.src)
  })
})

/* ---------- 文档：本地文件（blob URL + 文件名扩展名检测） ---------- */
document.getElementById('doc-file')!.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  docPreview.setAttribute('type', 'auto')
  docPreview.setAttribute('name', file.name)
  docPreview.setAttribute('src', URL.createObjectURL(file))
})

/* ---------- 文档：PDF 命令式 API ---------- */
document.getElementById('doc-page2')!.addEventListener('click', () => {
  ;(docPreview as unknown as { goToPage: (n: number) => void }).goToPage(2)
})

/* ---------- 文档：水印切换（watermark 属性：文字 / 图片，大小与间距可配置） ---------- */
const wmMap: Record<string, string> = {
  text: JSON.stringify({ text: '内部资料 · 禁止外传', fontSize: 18, gap: 120 }),
  image: JSON.stringify({ image: '/media/sample.svg', width: 120, gap: 100, opacity: 0.4 })
}
document.querySelectorAll<HTMLButtonElement>('[data-wm]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const value = wmMap[btn.dataset.wm!]
    if (value) docPreview.setAttribute('watermark', value)
    else docPreview.removeAttribute('watermark')
  })
})
