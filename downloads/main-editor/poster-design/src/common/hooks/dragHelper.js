/*
 * @Author: ShawnPhang
 * @Date: 2023-07-10 14:58:48
 * @Description: 拖拽优化
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-18 16:17:36
 */
import { useControlStore, useWidgetStore } from "@/store";
export default class DragHelper {
    cloneEl;
    dragging = false;
    initial = {};
    queue = [];
    constructor() {
        window.addEventListener('mousemove', (e) => {
            if (this.dragging && this.cloneEl) {
                const { width, height } = this.initial;
                // this.moveFlutter(e.pageX - offsetX, e.pageY - offsetY, this.distance(e))
                this.moveFlutter(e.pageX - width / 2, e.pageY - height / 2, this.distance(e));
            }
            else {
                this.finish();
            }
        });
        // 鼠标抬起
        window.addEventListener('mouseup', (e) => {
            const el = window.document.getElementById('app');
            if (!el || !e.target)
                return;
            el.classList.remove('drag_active');
            const target = e.target;
            const cl = target.classList;
            if (target.id === 'page-design-canvas' ||
                cl.contains('target') ||
                cl.contains('drop__mask') ||
                cl.contains('edit-text')) {
                setTimeout(() => {
                    this.finish(true);
                }, 10);
            }
            else
                this.finish();
        });
        // 鼠标离开了视窗
        document.addEventListener('mouseleave', (e) => {
            this.finish();
        });
        // 用户可能离开了浏览器
        window.onblur = () => {
            this.finish();
        };
    }
    /**
     * 拖动开始 mousedown
     */
    start(e, finallySize) {
        if (!this.cloneEl) {
            const controlStore = useControlStore();
            controlStore.setDraging(true);
            // store.commit('setDraging', true)
            const app = window.document.getElementById('app');
            if (!app || !e)
                return;
            app.classList.add('drag_active'); // 整个鼠标全局变成抓取
            const target = e.target;
            // 选中了元素
            this.cloneEl = target.cloneNode(true);
            this.cloneEl.classList.add('flutter');
            // 初始化数据
            this.init(e, target, finallySize || target.offsetWidth, Math.random());
            // 加载原图
            // simulate(cloneEl.src, initial.flag)
            this.cloneEl.style.width = `${target.offsetWidth}`;
            // e.target.parentElement.parentElement.appendChild(this.cloneEl)
            const widgetPanel = window.document.getElementById('widget-panel');
            if (!widgetPanel)
                return;
            widgetPanel.appendChild(this.cloneEl);
            this.dragging = true;
            target.classList.add('hide'); // 放在最后
            this.queue.push(() => {
                target.classList.remove('hide');
            });
        }
    }
    // 开始拖动初始化
    init({ offsetX, offsetY, pageX, pageY, x, y }, { offsetWidth: width, offsetHeight: height }, finallySize, flag) {
        this.initial = { offsetX, offsetY, pageX, pageY, width, height, finallySize, flag, x, y };
        // store.commit('setDragInitData', { offsetX: 0, offsetY: 0 })
        this.moveFlutter(pageX - offsetX, pageY - offsetY, 0, 0.3);
        setTimeout(() => {
            this.moveFlutter(pageX - width / 2, pageY - height / 2, 0, 0.3);
        }, 10);
    }
    // 改变漂浮元素（合并多个操作）
    moveFlutter(x, y, d = 0, lazy = 0) {
        const { width, height, finallySize } = this.initial;
        let scale = null;
        if (d) {
            if (width > finallySize) {
                scale = width - d >= finallySize ? `transform: scale(${(width - d) / width});` : null;
            }
            else {
                scale = width + d <= finallySize ? `transform: scale(${(width + d) / width})` : null;
            }
        }
        const options = [`left: ${x}px`, `top: ${y}px`, `width: ${width}px`, `height: ${height}px`];
        scale && options.push(scale);
        options.push(`transition: all ${lazy}s`);
        this.changeStyle(options);
    }
    changeStyle(arr) {
        if (!this.cloneEl)
            return;
        const original = this.cloneEl.style.cssText.split(';');
        original.pop();
        this.cloneEl.style.cssText = original.concat(arr).join(';') + ';';
    }
    // 结束/完成处理（动画）
    finish(done = false) {
        if (!this.dragging) {
            return;
        }
        const controlStore = useControlStore();
        const widgetStore = useWidgetStore();
        this.dragging = false;
        controlStore.setDraging(false);
        // store.commit('setDraging', false)
        widgetStore.setSelectItem({});
        // store.commit('selectItem', {})
        if (!done) {
            const { pageX, offsetX, pageY, offsetY } = this.initial;
            this.changeStyle([`left: ${pageX - offsetX}px`, `top: ${pageY - offsetY}px`, 'transform: scale(1)', 'transition: all 0.3s']);
        }
        setTimeout(() => {
            this.queue.length && this.queue.shift()();
            this.cloneEl && this.cloneEl.remove();
            this.cloneEl = null;
        }, done ? 0 : 300);
    }
    // 计算两点之间距离
    distance({ pageX, pageY }) {
        const { pageX: x, pageY: y } = this.initial;
        return Math.hypot(pageX - x, pageY - y);
    }
}
//# sourceMappingURL=dragHelper.js.map