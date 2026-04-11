import { defineStore } from "pinia";
const ForceStore = defineStore("forceStore", {
    state: () => ({
        zoomScreenChange: null, // 画布强制刷新适应度
        updateRect: null, // 强制刷新操作框
        updateSelect: null, // 强制设置选择元素
    }),
    actions: {
        setZoomScreenChange() {
            // 画布尺寸适应度强制刷新
            this.zoomScreenChange = Math.random();
        },
        setUpdateRect() {
            // 强制刷新操作框
            this.updateRect = Math.random();
        },
        setUpdateSelect() {
            // 强制触发元素选择
            this.updateSelect = Math.random();
        },
    }
});
export default ForceStore;
//# sourceMappingURL=index.js.map