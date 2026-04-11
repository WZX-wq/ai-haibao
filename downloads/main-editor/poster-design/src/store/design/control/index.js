/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-18 21:00:00
 * @Description:
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 09:27:45
 */
import { defineStore } from "pinia";
/** 全局控制配置 */
const ControlStore = defineStore("controlStore", {
    state: () => ({
        dMoving: false, // 是否正在移动组件
        dDraging: false, // 是否正在抓取组件
        dResizeing: false, // 是否正在调整组件宽高
        dShowRefLine: true, // 是否显示参考线
        showMoveable: false, // 全局控制选择框的显示
        showRotatable: true, // 是否显示moveable的旋转按钮
        dAltDown: false, // 记录是否按下alt键 / 或ctrl
        dCropUuid: '-1', // 正在编辑or裁剪的组件id
        dSpaceDown: false, // 记录是否按下空格键
    }),
    getters: {},
    actions: {
        setdMoving(bool) {
            this.dMoving = bool;
        },
        setDraging(drag) {
            this.dDraging = drag;
        },
        setdResizeing(bool) {
            this.dResizeing = bool;
        },
        showRefLine(show) {
            this.dShowRefLine = show;
        },
        setShowMoveable(show) {
            this.showMoveable = show;
            // if (!show) {
            //   // TODO: 失焦时设置面板也失去关联，但会导致某些失焦状态出错(如裁剪)
            //   state.dActiveElement = state.dPage
            // }
        },
        setShowRotatable(e) {
            this.showRotatable = e;
        },
        /** TODO 组合操作 */
        updateAltDown(e) {
            this.dAltDown = e;
            console.log('控制组合按键, 成组功能为: realCombined');
        },
        /** 组件调整结束 */
        stopDResize() {
            // if (this.dResizeing) {
            //   // store.dispatch('pushHistory', 'stopDResize')
            // }
            this.dResizeing = false;
        },
        /** 组件移动结束 */
        stopDMove() {
            // if (this.dMoving) {
            //   const historyStore = useHistoryStore()
            //   historyStore.pushHistory("stopDMove")
            //   // store.dispatch('pushHistory', 'stopDMove')
            // }
            this.dMoving = false;
        },
        setCropUuid(uuid) {
            // 设置正在裁剪or编辑的组件
            this.dCropUuid = uuid;
        },
        setSpaceDown(val) {
            this.dSpaceDown = val;
        }
    }
});
export default ControlStore;
//# sourceMappingURL=index.js.map