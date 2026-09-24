/**
 * @allfile-preview/core
 *
 * 跨框架文件预览 Web Components。
 * 引入本模块即完成所有自定义元素注册（副作用），
 * 直接在 HTML / Vue / React 模板中使用 <file-preview> 标签。
 */

// 组件注册（顺序：基础控件 → 播放器 → 各类型预览 → 主组件）
import './components/fv-slider'
import './components/media/file-preview-player'
import './components/file-preview-image'
import './components/file-preview-video'
import './components/file-preview-audio'
import './components/file-preview-pdf'
import './components/file-preview-text'
import './components/file-preview-markdown'
import './components/file-preview-docx'
import './components/file-preview-xlsx'
import './components/file-preview'

// 组件类导出（可用于 TypeScript 类型标注 / 命令式调用）
export { FvSlider } from './components/fv-slider'
export { FilePreviewPlayer } from './components/media/file-preview-player'
export { FilePreviewImage } from './components/file-preview-image'
export { FilePreviewVideo } from './components/file-preview-video'
export { FilePreviewAudio } from './components/file-preview-audio'
export { FilePreviewPdf } from './components/file-preview-pdf'
export { FilePreviewText } from './components/file-preview-text'
export { FilePreviewMarkdown } from './components/file-preview-markdown'
export { FilePreviewDocx } from './components/file-preview-docx'
export { FilePreviewXlsx } from './components/file-preview-xlsx'
export { FilePreview } from './components/file-preview'

// 工具导出
export { detectType, detectTypeByHead, mimeToType } from './detect'
export { formatTime } from './utils/format-time'
export { clamp } from './utils/clamp'

// 类型导出
export type { MediaType, TypeAttr, FvLoadDetail, FvErrorDetail, FvZoomDetail, FvRotateDetail, FvTimeupdateDetail, FvSeekDetail, FvVolumeDetail, FvPageDetail, FvActionItem, FvActionDetail, FvDownloadDetail, FvPlayerControls, FvRateDetail, FvFullscreenDetail, FvWatermarkOptions } from './types'
