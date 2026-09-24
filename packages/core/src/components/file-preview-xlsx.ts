import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import * as XLSX from 'xlsx'
import { clamp } from '../utils/clamp'
import { emit } from '../utils/dispatch'
import { fetchFileAsArrayBuffer } from '../utils/fetch-file'
import { themeStyles } from '../styles/theme'
import type { FvErrorDetail, FvLoadDetail } from '../types'

/* ---------- 图标 ---------- */
const ICON_ZOOM_IN = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_ZOOM_OUT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="8" y1="11" x2="14" y2="11" /></svg>`
const ICON_FIT = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h6v6H3z" /><path d="M15 3h6v6h-6z" /><path d="M3 15h6v6H3z" /><path d="M15 15h6v6h-6z" /></svg>`

/** 缩放范围 */
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

/**
 * 当前浏览器中 CSS zoom 是否影响 getBoundingClientRect（模块加载时探测一次）。
 * Chrome 128+（标准化 zoom）影响；旧版 Chrome 不影响（rect 恒返回未缩放的布局宽度）。
 * 用于把 rect 宽度换算成"自然宽度"，保证适应宽度计算幂等。
 */
const ZOOM_AFFECTS_RECT = (() => {
  try {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:100px;height:10px;zoom:2'
    document.body.appendChild(probe)
    const affected = probe.getBoundingClientRect().width > 150
    probe.remove()
    return affected
  } catch {
    return false
  }
})()

/** 单元格值类型 */
type Cell = string | number | boolean | Date | null | undefined

/** 最大渲染行数（防止超大表格卡死页面） */
const MAX_ROWS = 2000

/** 一个工作表的视图数据 */
interface SheetView {
  rows: Cell[][]
  merges: XLSX.Range[]
  colCount: number
  truncated: boolean
}

/** 解析工作表为二维数组 + 合并信息 */
function parseSheet(ws: XLSX.WorkSheet): SheetView {
  // 空表保护：无 !ref（无任何单元格）时直接返回空视图
  if (!ws || !ws['!ref']) {
    return { rows: [], merges: [], colCount: 0, truncated: false }
  }
  const raw = XLSX.utils.sheet_to_json<Cell[]>(ws, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: true
  })
  const merges = (ws['!merges'] || []) as XLSX.Range[]
  let colCount = raw.reduce((m, r) => Math.max(m, r.length), 0)
  for (const mg of merges) colCount = Math.max(colCount, mg.e.c + 1)
  const truncated = raw.length > MAX_ROWS
  return {
    rows: truncated ? raw.slice(0, MAX_ROWS) : raw,
    merges,
    colCount,
    truncated
  }
}

/** Date → 本地可读字符串（含时间时附带时分秒） */
function formatDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (d.getHours() || d.getMinutes() || d.getSeconds()) {
    return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  return date
}

/** 单元格值 → 显示文本 */
function cellText(v: Cell): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) return formatDate(v)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

/**
 * <file-preview-xlsx> Excel（.xlsx / .xls）预览
 *
 * - SheetJS 本地解析（局域网可用，无外部请求）
 * - 多工作表切换（tab 标签）
 * - 合并单元格（rowspan / colspan）、列宽、数字右对齐、日期格式化
 * - 悬浮缩放条（右上角）：缩小 / 放大 / 适应宽度（50% ~ 300%）
 * - 事件：load（detail 含 sheets 数量）/ error / zoom
 */
@customElement('file-preview-xlsx')
export class FilePreviewXlsx extends LitElement {
  @property() src = ''
  @property() name = ''

  @state() private loading = true
  @state() private errorMsg: string | null = null
  @state() private sheetNames: string[] = []
  @state() private activeSheet = 0
  @state() private view: SheetView | null = null
  /** 表格缩放倍数（1 = 原始尺寸） */
  @state() private zoom = 1

  private workbook: XLSX.WorkBook | null = null
  /** 当前列宽信息 */
  private cols: XLSX.ColInfo[] = []
  /** 合并起点 → 跨度 */
  private spanMap = new Map<string, { rowspan: number; colspan: number }>()
  /** 被合并覆盖、无需渲染的单元格 */
  private skipSet = new Set<string>()
  private loadToken = 0

  @query('.table-wrap') private wrapEl!: HTMLDivElement
  @query('table') private tableEl!: HTMLTableElement

  static styles = [
    themeStyles,
    css`
      .xlsx-viewer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--fv-doc-bg);
        border-radius: var(--fv-radius);
        overflow: hidden;
      }
      .sheet-bar {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px 0;
        background: var(--fv-surface);
        overflow-x: auto;
        scrollbar-width: thin;
      }
      .tab {
        flex: none;
        padding: 6px 14px;
        border: none;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: var(--fv-text-dim);
        font-size: 13px;
        cursor: pointer;
        white-space: nowrap;
        transition: color 0.15s, border-color 0.15s;
      }
      .tab:hover {
        color: var(--fv-text);
      }
      .tab.active {
        color: var(--fv-primary);
        border-bottom-color: var(--fv-primary);
        font-weight: 600;
      }
      .meta {
        flex: none;
        margin-left: auto;
        padding: 6px 4px;
        font-size: 12px;
        color: var(--fv-text-dim);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .table-wrap {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 10px 12px 12px;
      }
      table {
        border-collapse: collapse;
        font-size: 13px;
        color: var(--fv-doc-text);
      }
      th,
      td {
        border: 1px solid var(--fv-doc-border);
        padding: 4px 10px;
        min-width: 56px;
        max-width: 360px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        height: 28px;
        background: var(--fv-doc-bg);
      }
      th {
        position: sticky;
        left: 0;
        z-index: 1;
        min-width: 44px;
        color: var(--fv-doc-text-dim);
        font-weight: 400;
        font-variant-numeric: tabular-nums;
        background: var(--fv-doc-surface);
        user-select: none;
      }
      td.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .empty-sheet {
        padding: 32px 0;
        text-align: center;
        font-size: 13px;
        color: var(--fv-doc-text-dim);
      }
      .truncated-tip {
        flex: none;
        padding: 8px 16px;
        font-size: 12px;
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.08);
        text-align: center;
      }
    `
  ]

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('src')) void this.loadWorkbook()
  }

  /* ---------- 加载 ---------- */

  private async loadWorkbook() {
    const token = ++this.loadToken
    if (!this.src) {
      this.loading = false
      this.errorMsg = null
      this.workbook = null
      this.view = null
      this.sheetNames = []
      return
    }
    this.loading = true
    this.errorMsg = null

    try {
      const data = new Uint8Array(await fetchFileAsArrayBuffer(this.src))
      if (token !== this.loadToken) return

      // cellDates: 日期单元格直接解析为 Date 对象
      const wb = XLSX.read(data, { type: 'array', cellDates: true })
      if (token !== this.loadToken) return

      this.workbook = wb
      this.sheetNames = wb.SheetNames
      this.activeSheet = 0
      this.applyActiveSheet()
      this.loading = false
      const detail: FvLoadDetail = { type: 'xlsx', sheets: wb.SheetNames.length }
      emit(this, 'load', detail)
    } catch (err) {
      if (token !== this.loadToken) return
      this.loading = false
      const raw = (err as Error)?.message || String(err)
      // SheetJS 对加密工作簿报 "File is password-protected"
      const message = /password/i.test(raw)
        ? '表格文件已加密，暂不支持预览带密码的 Excel'
        : `表格加载失败：${raw}`
      this.errorMsg = message
      const detail: FvErrorDetail = { code: 'load-failed', message }
      emit(this, 'error', detail)
    }
  }

  /* ---------- 工作表切换 ---------- */

  private applyActiveSheet(): void {
    const ws = this.workbook?.Sheets[this.sheetNames[this.activeSheet]]
    if (!ws) {
      this.view = null
      return
    }
    this.view = parseSheet(ws)
    this.cols = (ws['!cols'] || []) as XLSX.ColInfo[]
    this.buildSpans(this.view)
  }

  private selectSheet(i: number): void {
    if (i === this.activeSheet || i < 0 || i >= this.sheetNames.length) return
    this.activeSheet = i
    this.applyActiveSheet()
  }

  /** 依据合并范围构建跨度与跳过集合 */
  private buildSpans(view: SheetView): void {
    this.spanMap.clear()
    this.skipSet.clear()
    const rowLimit = view.rows.length
    for (const { s, e } of view.merges) {
      this.spanMap.set(`${s.r},${s.c}`, {
        // rowspan 不超过实际渲染行数（截断保护）
        rowspan: Math.min(e.r - s.r + 1, rowLimit - s.r),
        colspan: e.c - s.c + 1
      })
      for (let r = s.r; r <= e.r; r++) {
        if (r >= rowLimit) break
        for (let c = s.c; c <= e.c; c++) {
          if (r !== s.r || c !== s.c) this.skipSet.add(`${r},${c}`)
        }
      }
    }
  }

  reload(): void {
    void this.loadWorkbook()
  }

  /* ---------- 缩放 ---------- */

  zoomBy(factor: number): void {
    const next = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    if (next === this.zoom) return
    this.zoom = next
    emit(this, 'zoom', { scale: next })
  }

  /** 适应宽度：缩放到恰好撑满可用宽度（可放大也可缩小；重复点击幂等） */
  fitWidth(): void {
    const table = this.tableEl
    const wrap = this.wrapEl
    if (!table || !wrap) return
    const rendered = table.getBoundingClientRect().width
    if (rendered <= 0) return
    const available = wrap.clientWidth - 24 // 与 .table-wrap 左右 padding 匹配（12px × 2）
    if (available <= 0) return
    // rect 是否含 zoom 效果因浏览器版本而异 → 统一换算成自然宽度再计算
    const natural = ZOOM_AFFECTS_RECT ? rendered / this.zoom : rendered
    const next = clamp(Number((available / natural).toFixed(3)), MIN_ZOOM, MAX_ZOOM)
    if (next === this.zoom) return
    this.zoom = next
    emit(this, 'zoom', { scale: next })
  }

  /* ---------- 渲染 ---------- */

  /** 列宽（优先 wpx 像素，其次 wch 字符宽估算） */
  private colWidthStyle(i: number): string {
    const col = this.cols[i]
    if (!col) return ''
    if (col.wpx) return `width:${Math.round(col.wpx)}px;`
    if (col.wch) return `width:${Math.round(col.wch * 8 + 16)}px;`
    return ''
  }

  private renderRow(row: Cell[], r: number) {
    const colCount = this.view?.colCount || 0
    const cells = []
    for (let c = 0; c < colCount; c++) {
      const key = `${r},${c}`
      if (this.skipSet.has(key)) continue
      const span = this.spanMap.get(key)
      const v = row[c]
      cells.push(html`
        <td
          class=${typeof v === 'number' ? 'num' : ''}
          style=${this.colWidthStyle(c)}
          rowspan=${span && span.rowspan > 1 ? span.rowspan : nothing}
          colspan=${span && span.colspan > 1 ? span.colspan : nothing}
          title=${cellText(v)}
          >${cellText(v)}</td
        >
      `)
    }
    return html`<tr><th>${r + 1}</th>${cells}</tr>`
  }

  protected render() {
    const view = this.view
    return html`
      <div class="xlsx-viewer">
        <div class="sheet-bar" part="toolbar">
          ${this.sheetNames.map(
            (n, i) => html`
              <button class="tab ${i === this.activeSheet ? 'active' : ''}" @click=${() => this.selectSheet(i)}>${n}</button>
            `
          )}
          ${view
            ? html`<span class="meta">${view.rows.length} 行 × ${view.colCount} 列</span>`
            : nothing}
        </div>
        <div class="table-wrap">
          ${view
            ? view.rows.length
              ? html`<table part="media" style="zoom:${this.zoom}">${view.rows.map((row, r) => this.renderRow(row, r))}</table>`
              : html`<div class="empty-sheet">当前工作表为空</div>`
            : nothing}
        </div>
        ${view && view.rows.length
          ? html`
              <div class="fv-zoom-bar" part="zoom-bar">
                <button class="fv-btn" ?disabled=${this.zoom <= MIN_ZOOM} @click=${() => this.zoomBy(1 / 1.25)} aria-label="缩小" title="缩小">${ICON_ZOOM_OUT}</button>
                <span class="fv-zoom-label">${Math.round(this.zoom * 100)}%</span>
                <button class="fv-btn" ?disabled=${this.zoom >= MAX_ZOOM} @click=${() => this.zoomBy(1.25)} aria-label="放大" title="放大">${ICON_ZOOM_IN}</button>
                <button class="fv-btn" @click=${() => this.fitWidth()} aria-label="适应宽度" title="适应宽度">${ICON_FIT}</button>
              </div>
            `
          : nothing}
        ${view?.truncated
          ? html`<div class="truncated-tip">表格过大，仅显示前 ${MAX_ROWS.toLocaleString()} 行</div>`
          : nothing}
        ${this.loading && !this.errorMsg
          ? html`<div class="fv-loading"><slot name="loading"><div class="fv-spinner"></div></slot></div>`
          : nothing}
        ${this.errorMsg
          ? html`
              <div class="fv-error" part="error-box">
                <slot name="error">
                  <div class="fv-error-msg">${this.errorMsg}</div>
                </slot>
              </div>
            `
          : nothing}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'file-preview-xlsx': FilePreviewXlsx
  }
}
