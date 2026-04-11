/*
 * @Author: ShawnPhang
 * @Date: 2021-12-24 15:13:58
 * @Description: 资源加载
 * @LastEditors: ShawnPhang <https://m.palxp.cn>, Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-03-05 12:00:00
 */
export default class PreLoad {
    i;
    arr;
    constructor(arr) {
        this.i = 0;
        this.arr = arr;
    }
    imgs() {
        return new Promise((resolve) => {
            const work = (src) => {
                if (this.i < this.arr.length) {
                    const img = new Image();
                    img.src = src;
                    if (img.complete) {
                        work(this.arr[this.i++]);
                    }
                    else {
                        img.onload = () => {
                            work(this.arr[this.i++]);
                            img.onload = null;
                        };
                    }
                    // console.log(((this.i + 1) / this.arr.length) * 100);
                }
                else {
                    resolve();
                }
            };
            work(this.arr[this.i]);
        });
    }
    doms() {
        return new Promise((resolve) => {
            const work = () => {
                if (this.i < this.arr.length) {
                    this.arr[this.i].complete && this.i++;
                    setTimeout(() => {
                        work();
                    }, 100);
                }
                else {
                    resolve();
                }
            };
            work();
        });
    }
    /** 判断是否加载svg */
    svgs() {
        return new Promise((resolve) => {
            const work = () => {
                if (this.i < this.arr.length) {
                    this.arr[this.i].length > 0 && this.i++;
                    setTimeout(() => {
                        work();
                    }, 100);
                }
                else {
                    resolve();
                }
            };
            work();
        });
    }
}
//# sourceMappingURL=preload.js.map