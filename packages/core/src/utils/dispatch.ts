/**
 * 在元素上派发 CustomEvent（bubbles + composed）。
 * composed 让事件从 Shadow DOM 穿透到外层（Vue/React/原生 addEventListener 都能收到）。
 */
export function emit(el: EventTarget, name: string, detail?: unknown): void {
  el.dispatchEvent(
    new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true
    })
  )
}
