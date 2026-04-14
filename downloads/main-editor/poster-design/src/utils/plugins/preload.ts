/*
 * @Author: ShawnPhang
 * @Date: 2021-12-24 15:13:58
 * @Description: 资源加载
 * @LastEditors: ShawnPhang <https://m.palxp.cn>, Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-03-05 12:00:00
 */
export default class PreLoad {
  private i: number
  private arr: (string | HTMLImageElement | ChildNode[])[]
  constructor(arr: (string | HTMLImageElement | ChildNode[])[]) {
    this.i = 0
    this.arr = arr
  }
  public imgs() {
    return new Promise<void>((resolve) => {
      const work = (src: string) => {
        if (this.i < this.arr.length) {
          const img = new Image()
          img.src = src
          if (img.complete) {
            work(this.arr[this.i++] as string)
          } else {
            img.onload = () => {
              work(this.arr[this.i++] as string)
              img.onload = null
            }
          }
          // console.log(((this.i + 1) / this.arr.length) * 100);
        } else {
          resolve()
        }
      }
      work(this.arr[this.i] as string)
    })
  }
  public doms() {
    return new Promise<void>((resolve) => {
      const tries: number[] = []
      const work = () => {
        if (this.i >= this.arr.length) {
          resolve()
          return
        }
        const img = this.arr[this.i] as HTMLImageElement
        tries[this.i] = (tries[this.i] || 0) + 1
        const stalled = !img || tries[this.i] > 200
        if (img?.complete || stalled) {
          this.i++
        }
        setTimeout(work, 100)
      }
      work()
    })
  }
  /**
   * 等待 SVG 容器出现子节点（Snap.parse / Snap.load 异步挂载）。
   * 旧逻辑在 childNodes.length===0 时永不 i++，会导致 Promise 死锁，服务端截图页卡死。
   */
  public svgs() {
    return new Promise<void>((resolve) => {
      const tries: number[] = []
      const work = () => {
        if (this.i >= this.arr.length) {
          resolve()
          return
        }
        const nodes = this.arr[this.i] as ChildNode[]
        tries[this.i] = (tries[this.i] || 0) + 1
        const hasChildren = !!(nodes && nodes.length > 0)
        const giveUp = tries[this.i] > 80
        if (hasChildren || giveUp) {
          this.i++
        }
        setTimeout(work, 50)
      }
      work()
    })
  }
}
