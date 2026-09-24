import { css } from 'lit'

/**
 * 所有组件共享的主题样式。
 * CSS 变量可被外部覆盖：file-preview { --fv-primary: red; }
 * ::part() 钩子在各组件内按需暴露。
 */
export const themeStyles = css`
  :host {
    /* 主题变量（外部可通过 CSS 覆盖，或用 color 属性设置主色） */
    --fv-primary: #3b82f6;
    --fv-bg: #0f172a;
    --fv-surface: #1e293b;
    --fv-surface-2: rgba(255, 255, 255, 0.1);
    /* 预览舞台背景：所有类型预览主体区域的统一背景（覆盖即可全局换底色） */
    --fv-stage: #0f172a;
    /* 文档类（txt / markdown / xlsx）内容区为白色纸张风格（覆盖即可整体自定义） */
    --fv-doc-bg: #ffffff;
    --fv-doc-text: #111827;
    --fv-doc-text-dim: #64748b;
    --fv-doc-border: #e2e8f0;
    --fv-doc-surface: #f1f5f9;
    --fv-text: #f1f5f9;
    --fv-text-dim: #94a3b8;
    --fv-radius: 10px;
    --fv-error: #ef4444;

    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 100%;
    min-height: 220px;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  /* 通用按钮 */
  .fv-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 34px;
    height: 34px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--fv-text);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .fv-btn:hover {
    background: var(--fv-surface-2);
  }
  .fv-btn:active {
    transform: scale(0.94);
  }
  .fv-btn.active {
    color: var(--fv-primary);
  }
  .fv-btn svg {
    width: 20px;
    height: 20px;
    display: block;
  }

  /* 悬浮缩放条（pdf / docx / xlsx 共用：悬浮于预览区右上角） */
  .fv-zoom-bar {
    position: absolute;
    top: 40px;
    right: 30px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 6px;
    background: var(--fv-surface);
    border: 1px solid var(--fv-surface-2);
    border-radius: 999px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  }
  .fv-zoom-bar .fv-btn {
    width: 28px;
    height: 28px;
    border-radius: 7px;
  }
  .fv-zoom-bar .fv-btn svg {
    width: 16px;
    height: 16px;
  }
  .fv-zoom-label {
    min-width: 44px;
    text-align: center;
    font-size: 12px;
    color: var(--fv-text-dim);
    font-variant-numeric: tabular-nums;
    user-select: none;
  }

  /* 加载中 */
  .fv-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .fv-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--fv-surface-2);
    border-top-color: var(--fv-primary);
    border-radius: 50%;
    animation: fv-spin 0.8s linear infinite;
  }
  @keyframes fv-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* 错误态 */
  .fv-error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: var(--fv-bg);
    color: var(--fv-text-dim);
    text-align: center;
  }
  .fv-error .fv-error-icon {
    width: 40px;
    height: 40px;
    color: var(--fv-error);
  }
  .fv-error .fv-error-msg {
    font-size: 13px;
    line-height: 1.5;
    word-break: break-all;
    max-width: 90%;
  }
  .fv-error .fv-retry {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid var(--fv-surface-2);
    border-radius: 999px;
    background: transparent;
    color: var(--fv-text);
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .fv-error .fv-retry:hover {
    border-color: var(--fv-primary);
    background: var(--fv-surface-2);
  }
`
