/**
 * 示例媒体资源（两个 demo 共用）。
 *
 * - 本地资源（/media/...）：由 `npm run gen:media` 生成到各 demo 的 public/media/，
 *   离线可用（音频为脚本生成的正弦波 WAV，图片为内置 SVG）
 * - 远程资源：用于演示真实网络文件（需联网）
 */
export const MEDIA = {
  image: {
    /** 本地 SVG（gen:media 生成） */
    local: '/media/sample.svg',
    /** 远程图片 */
    remote: 'https://picsum.photos/1200/800',
    /** 404 地址（演示错误态） */
    broken: 'https://example.com/not-exist.png'
  },
  video: {
    /** 公开示例视频（需联网；备用：https://media.w3.org/2010/05/sintel/trailer.mp4） */
    remote: 'https://www.w3schools.com/html/mov_bbb.mp4',
    broken: 'https://example.com/not-exist.mp4'
  },
  audio: {
    /** 本地生成的正弦波 WAV（gen:media 生成，离线可用） */
    local: '/media/tone.wav',
    /** 远程 MP3（需联网） */
    remote: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  pdf: {
    /** 本地生成的纯文本 PDF（gen:media 生成，两页，离线可用） */
    local: '/media/sample.pdf',
    /** pdfjs cMaps 目录（gen:media 复制到 public/pdf/cmaps；中文非嵌入字体 PDF 需要） */
    cMapUrl: '/pdf/cmaps/'
  },
  text: {
    /** 本地生成的中英文 TXT（gen:media 生成，UTF-8） */
    local: '/media/sample.txt'
  },
  markdown: {
    /** 本地生成的 Markdown（gen:media 生成，覆盖标题/列表/代码块/表格等语法） */
    local: '/media/sample.md'
  },
  docx: {
    /** 本地生成的 DOCX（gen:media 生成，含标题/列表/表格，离线可用） */
    local: '/media/sample.docx'
  },
  xlsx: {
    /** 本地生成的 XLSX（gen:media 生成，双工作表 + 合并单元格，离线可用） */
    local: '/media/sample.xlsx'
  }
} as const
