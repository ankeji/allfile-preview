/**
 * 零二进制媒体生成脚本：为两个 demo 生成可离线使用的示例文件。
 * - tone.wav：C 大调琶音正弦波（约 7 秒，44.1kHz 16bit 单声道）
 * - sample.svg：复制内置 SVG 图片
 * - sample.txt：中英文混合文本（UTF-8）
 * - sample.pdf：手写纯文本 PDF（两页，精确 xref 偏移，零依赖）
 * - sample.docx：docx 包生成（标题 / 段落 / 加粗斜体 / 列表 / 表格）
 * - sample.xlsx：xlsx 包生成（双工作表 / 合并单元格 / 列宽 / 日期 / 数字）
 * - pdf/cmaps/：复制 pdfjs-dist cmaps（中文 PDF cMap 支持，见 README）
 *
 * 生成物位于各 demo 的 public 目录（已 gitignore）。
 * 注意：本文件的块注释中不要出现斜杠星号路径写法（会提前闭合注释）。
 */
import { copyFileSync, cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const targets = [
  join(__dirname, '../vanilla/public/media'),
  join(__dirname, '../vue2-demo/public/media')
]
const pdfCmapTargets = [
  join(__dirname, '../vanilla/public/pdf'),
  join(__dirname, '../vue2-demo/public/pdf')
]

/* ---------- WAV 合成 ---------- */
const SAMPLE_RATE = 44100
// C4 E4 G4 C5 上行琶音 + 下行，循环
const NOTES = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63]
const NOTE_DURATION = 0.55
const TOTAL_SECONDS = 7

function synthesize() {
  const total = Math.floor(SAMPLE_RATE * TOTAL_SECONDS)
  const data = Buffer.alloc(total * 2) // 16bit 单声道
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE
    const noteIndex = Math.floor(t / NOTE_DURATION) % NOTES.length
    const lt = t % NOTE_DURATION
    // 基频 + 一个八度泛音，指数衰减包络（模拟拨弦感）
    const freq = NOTES[noteIndex]
    const env = Math.exp(-3.2 * lt) * Math.min(1, lt * 80)
    const wave =
      Math.sin(2 * Math.PI * freq * t) * 0.6 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.18
    data.writeInt16LE(Math.round(wave * env * 0.55 * 32767), i * 2)
  }
  return data
}

function wavBuffer(pcm) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // fmt 块长度
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // 单声道
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28) // 字节率
  header.writeUInt16LE(2, 32) // 块对齐
  header.writeUInt16LE(16, 34) // 位深
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/* ---------- TXT 生成 ---------- */
function txtBuffer() {
  const lines = [
    '文件预览组件 - 文本预览测试 File Preview Text Test',
    '================================================',
    '',
    '一、功能说明',
    '1. 自动编码检测：UTF-8 优先，失败后依次尝试 GB18030 / Big5 / Latin-1',
    '2. 等宽字体渲染，带行号显示',
    '3. 超大文件自动截断保护（前 500,000 字符）',
    '',
    '二、English Section',
    'The quick brown fox jumps over the lazy dog.',
    'Special chars: <html> & "quotes" ' + "'single'" + ' ... 100% $100',
    '',
    '三、常见代码片段',
    '',
    'function hello(name) {',
    "  console.log(`Hello, ${name}!`)",
    '}',
    '',
    '{"project": "file-preview", "version": "0.1.0", "types": 7}',
    '',
    '四、说明：本文件为 UTF-8 编码生成，可直接验证文本预览效果。'
  ]
  return Buffer.from(lines.join('\r\n') + '\r\n', 'utf8')
}

/* ---------- PDF 生成（手写最小 PDF，两页，精确 xref） ---------- */

/** 转义 PDF literal string 中的特殊字符 */
function pdfEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/** 单页内容流：从顶部逐行绘制（Helvetica，基础 14 字体，仅 ASCII/WinAnsi） */
function pdfContentStream(lines) {
  let s = 'BT\n/F1 18 Tf\n72 720 Td\n'
  for (const line of lines) {
    if (line === '') {
      s += '0 -24 Td\n'
      continue
    }
    s += `(${pdfEscape(line)}) Tj\n0 -26 Td\n`
  }
  s += 'ET\n'
  return s
}

/**
 * 构建多页 PDF Buffer：
 * 对象布局 1=Catalog 2=Pages 3=Font，其后每页一组（Page + Contents）
 */
function buildPdf(pageTexts) {
  const fontNum = 3
  const pageNums = pageTexts.map((_, i) => 4 + i * 2)
  const contentNums = pageTexts.map((_, i) => 5 + i * 2)

  /** @type {Array<{body?: string, stream?: string}>} */
  const objs = []
  objs[1] = { body: '<< /Type /Catalog /Pages 2 0 R >>' }
  objs[2] = {
    body: `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`
  }
  objs[fontNum] = { body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' }
  pageTexts.forEach((lines, i) => {
    objs[pageNums[i]] = {
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNums[i]} 0 R >>`
    }
    objs[contentNums[i]] = { stream: pdfContentStream(lines) }
  })

  let out = '%PDF-1.4\n'
  const offsets = []
  for (let num = 1; num < objs.length; num++) {
    offsets[num] = Buffer.byteLength(out, 'latin1')
    const obj = objs[num]
    if (obj.stream != null) {
      const len = Buffer.byteLength(obj.stream, 'latin1')
      out += `${num} 0 obj\n<< /Length ${len} >>\nstream\n${obj.stream}\nendstream\nendobj\n`
    } else {
      out += `${num} 0 obj\n${obj.body}\nendobj\n`
    }
  }
  const xrefPos = Buffer.byteLength(out, 'latin1')
  const size = objs.length
  out += `xref\n0 ${size}\n`
  out += '0000000000 65535 f \n'
  for (let num = 1; num < size; num++) {
    out += `${String(offsets[num]).padStart(10, '0')} 00000 n \n`
  }
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

function pdfBuffer() {
  return buildPdf([
    [
      'File Preview Component - PDF Test',
      '',
      'This PDF is generated by a zero-dependency script.',
      'It contains plain text only (Helvetica, base-14 font).',
      '',
      'Page 1 / 2',
      'Use the toolbar to navigate pages and zoom in / out.'
    ],
    [
      'Page 2 / 2',
      '',
      'Features:',
      '1. Rendered locally by pdf.js - no external requests.',
      '2. Works in LAN (offline) environments.',
      '3. Pagination, zoom and fit-width are supported.',
      '',
      'For CJK (Chinese) PDFs with non-embedded fonts,',
      'set the cMapUrl attribute to a deployed cmaps directory.'
    ]
  ])
}

/* ---------- Markdown 生成 ---------- */
function markdownBuffer() {
  const md = [
    '# 文件预览组件 - Markdown 测试',
    '',
    '> 一份用于验证 Markdown 渲染效果的示例文档，覆盖常见语法元素。',
    '',
    '## 1. 文本样式',
    '',
    '支持 **加粗**、*斜体*、~~删除线~~、`行内代码` 以及 [链接](https://example.com)。',
    '',
    '## 2. 列表',
    '',
    '无序列表：',
    '',
    '- 图片 / 视频 / 音频预览',
    '- PDF / 文本 / Markdown 预览',
    '- Word (docx) / Excel (xlsx) 预览',
    '',
    '有序列表：',
    '',
    '1. 引入组件库',
    '2. 设置 `src` 属性',
    '3. 自动识别文件类型并渲染',
    '',
    '## 3. 代码块',
    '',
    '```js',
    "// 原生 HTML 用法",
    '<file-preview-doc src="/media/sample.docx"></file-preview-doc>',
    '```',
    '',
    '```ts',
    'interface FvLoadDetail {',
    '  type: MediaType',
    '  pages?: number',
    '  encoding?: string',
    '}',
    '```',
    '',
    '## 4. 表格',
    '',
    '| 类型 | 渲染方案 | 离线可用 |',
    '| ---- | -------- | :------: |',
    '| PDF | pdf.js | 是 |',
    '| Word | docx-preview | 是 |',
    '| Excel | SheetJS | 是 |',
    '| Markdown | marked | 是 |',
    '',
    '## 5. 引用与分隔线',
    '',
    '> 层级引用',
    '>> 所有解析库均已打包进产物，局域网环境零外部请求。',
    '',
    '---',
    '',
    '## 6. 任务列表（GFM）',
    '',
    '- [x] 图片 / 音视频预览',
    '- [x] PDF / 文本 / Markdown 预览',
    '- [x] Word / Excel 预览',
    '- [ ] 更多格式支持（PPT 等）',
    '',
    '文档结束。'
  ]
  return Buffer.from(md.join('\n') + '\n', 'utf8')
}

/* ---------- DOCX 生成（docx 包） ---------- */
async function docxBuffer() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'File Preview 组件测试文档',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: '副标题：docx-preview 本地渲染（局域网可用）', italics: true, color: '666666', size: 21 })
            ]
          }),
          new Paragraph(''),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('一、功能列表')]
          }),
          new Paragraph({ text: '图片 / 视频 / 音频 / PDF / 文本 / Word / Excel 预览', bullet: { level: 0 } }),
          new Paragraph({ text: '跨框架：原生 HTML、Vue2、Vue3、React', bullet: { level: 0 } }),
          new Paragraph({ text: '纯本地解析，所有依赖打包内联，无 CDN 请求', bullet: { level: 0 } }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('二、段落样式')]
          }),
          new Paragraph({
            children: [
              new TextRun('这段文字包含 '),
              new TextRun({ text: '加粗', bold: true }),
              new TextRun('、'),
              new TextRun({ text: '斜体', italics: true }),
              new TextRun(' 和 '),
              new TextRun({ text: '红色文字', color: 'CC0000' }),
              new TextRun(' 的混排效果，验证富文本渲染。')
            ]
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun('三、表格示例')]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '类型', bold: true })] })], borders: { top: border, bottom: border, left: border, right: border } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '渲染方案', bold: true })] })], borders: { top: border, bottom: border, left: border, right: border } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '离线', bold: true })] })], borders: { top: border, bottom: border, left: border, right: border } })
                ]
              }),
              ...[
                ['PDF', 'pdf.js', '是'],
                ['Word', 'docx-preview', '是'],
                ['Excel', 'SheetJS', '是'],
                ['文本', 'TextDecoder', '是']
              ].map(
                (row) =>
                  new TableRow({
                    children: row.map(
                      (t) =>
                        new TableCell({
                          children: [new Paragraph(t)],
                          borders: { top: border, bottom: border, left: border, right: border }
                        })
                    )
                  })
              )
            ]
          }),
          new Paragraph(''),
          new Paragraph('—— 文档结束 ——')
        ]
      }
    ]
  })
  return Packer.toBuffer(doc)
}

/* ---------- XLSX 生成（SheetJS） ---------- */
function writeXlsx(filePath) {
  // Sheet 1：员工名单（含表头、日期、数字、合并单元格、列宽）
  const ws1 = XLSX.utils.aoa_to_sheet(
    [
      ['2026 年度员工名单（示例数据）'],
      [],
      ['编号', '姓名', '部门', '入职日期', '月薪(元)', '在职'],
      ['E001', '张三', '技术部', new Date('2021-03-15'), 18000, true],
      ['E002', '李四', '产品部', new Date('2020-07-01'), 16500, true],
      ['E003', '王五', '设计部', new Date('2022-11-20'), 14000, false],
      ['E004', '赵六', '技术部', new Date('2019-05-08'), 21000, true],
      ['E005', '钱七', '人事部', new Date('2023-01-30'), 12000, true]
    ],
    { cellDates: true }
  )
  ws1['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 }]
  // 标题行 A1:F1 合并
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]

  // Sheet 2：产品销量（数字矩阵，验证多 sheet 切换与右对齐）
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['产品', 'Q1', 'Q2', 'Q3', 'Q4', '合计'],
    ['组件库授权', 120, 150, 180, 210, 660],
    ['技术支持服务', 45, 60, 55, 80, 240],
    ['定制开发项目', 8, 10, 12, 15, 45],
    ['培训课程', 30, 25, 40, 35, 130]
  ])
  ws2['!cols'] = [{ wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, '员工名单')
  XLSX.utils.book_append_sheet(wb, ws2, '产品销量')
  XLSX.writeFile(wb, filePath)
}

/* ---------- 执行 ---------- */
const wav = wavBuffer(synthesize())
const svgSrc = join(__dirname, 'assets/sample.svg')
const txt = txtBuffer()
const pdf = pdfBuffer()
const md = markdownBuffer()
const docx = await docxBuffer()

for (const dir of targets) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'tone.wav'), wav)
  copyFileSync(svgSrc, join(dir, 'sample.svg'))
  writeFileSync(join(dir, 'sample.txt'), txt)
  writeFileSync(join(dir, 'sample.pdf'), pdf)
  writeFileSync(join(dir, 'sample.md'), md)
  writeFileSync(join(dir, 'sample.docx'), docx)
  writeXlsx(join(dir, 'sample.xlsx'))
  console.log(`[gen-media] 已生成: ${dir} (wav/svg/txt/pdf/md/docx/xlsx)`)
}

// 复制 pdfjs cmaps（供 cMapUrl 属性演示：非嵌入字体的中文 PDF 需要）
const cmapsSrc = join(__dirname, '../../node_modules/pdfjs-dist/cmaps')
if (existsSync(cmapsSrc)) {
  for (const dir of pdfCmapTargets) {
    cpSync(cmapsSrc, join(dir, 'cmaps'), { recursive: true })
    console.log(`[gen-media] 已复制 cmaps: ${dir}\\cmaps`)
  }
} else {
  console.warn('[gen-media] 未找到 pdfjs-dist/cmaps，跳过复制')
}

console.log('完成。提示：视频示例使用远程 URL（见 demos/shared/media.ts），离线环境可自行放置 mp4 到 public/media/ 并修改常量。')
