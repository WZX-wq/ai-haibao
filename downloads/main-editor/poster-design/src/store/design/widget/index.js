/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-18 21:00:00
 * @Description: Store方法export
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-18 17:11:51
 */
import { defineStore } from "pinia";
import useCanvasStore from '../canvas';
import { dMove, initDMove, setDropOver, setMouseEvent, setdActiveElement, updateGroupSize, updateHoverUuid } from "./actions";
import { dResize, initDResize, resize, autoResizeAll } from "./actions/resize";
import { addWidget, deleteWidget, setDWidgets, updateDWidgets, setWidgetStyle, updateWidgetData, updateWidgetMultiple, lockWidgets, setDLayouts } from "./actions/widget";
import { addGroup } from "./actions/group";
import { setTemplate } from "./actions/template";
import { copyWidget, pasteWidget } from "./actions/clone";
import { selectItem, selectWidget, selectWidgetsInOut } from "./actions/select";
import { updateAlign } from "./actions/align";
// import { TWidgetJsonData, widgetJsonData } from "./getter";
import { ungroup, updateLayerIndex } from "./actions/layer";
import pageDefault from "../canvas/page-default";
const WidgetStore = defineStore("widgetStore", {
    state: () => ({
        dActiveWidgetXY: {
            x: 0, // 选中组件的横向初始值
            y: 0, // 选中组件的纵向初始值
        },
        dMouseXY: {
            x: 0, // 鼠标按下时的横坐标
            y: 0, // 鼠标按下时的纵坐标
        },
        dResizeWH: {
            // 初始化调整大小时组件的宽高
            width: 0,
            height: 0,
        },
        dActiveElement: null, // 选中的组件或页面
        dHoverUuid: '-1', // 鼠标在这个图层上
        dDropOverUuid: '', // 拖动时放在哪个图层上
        dWidgets: [], // 已使用的组件
        dLayouts: [{
                global: pageDefault,
                layers: []
            }], // 页面与图层数据
        dSelectWidgets: [], // 记录多选的组件
        selectItem: { data: null }, // 记录当前选择的元素, data
        activeMouseEvent: null, // 正在活动的鼠标事件
        dCopyElement: [], // 复制的组件（可能是单个也可能是数组）
    }),
    // getters: {
    //   getWidgets(store) {
    //     return widgetJsonData(store)
    //   }
    // },
    actions: {
        initDMove(payload) { initDMove(this, payload); },
        dMove(payload) { dMove(this, payload); },
        updateGroupSize(uuid) { updateGroupSize(this, uuid); },
        initDResize(payload) { initDResize(this, payload); },
        dResize(payload) { dResize(this, payload); },
        updateHoverUuid(uuid) { updateHoverUuid(this, uuid); },
        updateWidgetData(payload) { updateWidgetData(this, payload); },
        updateWidgetMultiple(payload) { updateWidgetMultiple(this, payload); },
        addWidget(setting) { addWidget(this, setting); },
        addGroup(group) { addGroup(this, group); },
        setTemplate(template) { setTemplate(this, template); },
        deleteWidget() { deleteWidget(this); },
        copyWidget() { copyWidget(this); },
        pasteWidget() { pasteWidget(this); },
        selectWidget(data) { selectWidget(this, data); },
        selectWidgetsInOut(data) { selectWidgetsInOut(this, data); },
        updateAlign(data) { updateAlign(this, data); },
        updateLayerIndex(data) { updateLayerIndex(this, data); },
        ungroup(uuid) { ungroup(this, uuid); },
        setDropOver(uuid) { setDropOver(this, uuid); },
        setSelectItem(data) { selectItem(this, data); },
        resize(data) { resize(this, data); },
        setWidgetStyle(data) { setWidgetStyle(this, data); },
        setDWidgets(data) { setDWidgets(this, data); },
        updateDWidgets() { updateDWidgets(this); },
        lockWidgets() { lockWidgets(this); },
        setMouseEvent(event) { setMouseEvent(this, event); },
        setdActiveElement(data) { setdActiveElement(this, data); },
        autoResizeAll(data) { autoResizeAll(this, data); },
        setDLayouts(data) { setDLayouts(this, data); },
        getWidgets() {
            const pageStore = useCanvasStore();
            !this.dLayouts[pageStore.dCurrentPage] && pageStore.setDCurrentPage(pageStore.dCurrentPage - 1);
            // !this.dLayouts[pageStore.dCurrentPage] && pageStore.dCurrentPage--
            return this.dLayouts[pageStore.dCurrentPage].layers;
        }
    }
});
export default WidgetStore;
//# sourceMappingURL=index.js.map