/**
 * 统一文件获取：所有文档类预览组件共用。
 * 将常见失败场景转换为友好的中文错误信息（网络中断 / 跨域被拒 / file:// 协议限制）。
 */
export async function fetchFileAsArrayBuffer(src: string): Promise<ArrayBuffer> {
  let res: Response
  try {
    res = await fetch(src)
  } catch {
    // fetch 直接抛错：断网 / DNS 失败 / CORS 被拒 / file:// 协议
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      throw new Error(
        'file:// 协议下浏览器禁止读取本地文件，请通过 http(s) 服务访问，或用 <input type="file"> 选择文件后传入 blob URL'
      )
    }
    throw new Error('网络请求失败（地址错误 / 网络不可用 / 服务器未允许跨域访问）')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`)
  return res.arrayBuffer()
}
