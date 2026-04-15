/*
 * @Author: ShawnPhang
 * @Date: 2021-08-02 18:13:32
 * @Description:
 * @LastEditors: ShawnPhang
 * @LastEditTime: 2021-08-02 18:13:52
 */

export default (url: string) => {
  if (!url) return
  if (document.querySelector(`link[rel="stylesheet"][href="${url}"]`)) return
  const link_element = document.createElement('link')
  link_element.setAttribute('rel', 'stylesheet')
  link_element.setAttribute('href', url)
  link_element.onerror = () => {
    // 外部字体可能受网络/CDN波动影响，失败时不阻断页面功能。
    link_element.remove()
  }
  document.head.appendChild(link_element)
}
