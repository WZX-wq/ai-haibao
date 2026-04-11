/*
 * @Author: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @Date: 2024-03-18 21:00:00
 * @Description: 画布全局配置
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-09-25 00:39:00
 */
import { defineStore } from 'pinia';
import useWidgetStore from '../widget';
import pageDefault from './page-default';
import { repairKnownMojibake } from '@/utils/decodeText';
/** 画布全局设置 */
const CanvasStore = defineStore("canvasStore", {
    state: () => ({
        dZoom: 0, // 画布缩放百分比
        dPresetPadding: 25, // 画布默认预留边距
        dBottomHeight: 0, // 画布底部工具栏高度
        dPaddingTop: 0, // 用于画布垂直居中的修正值
        dScreen: {
            width: 0, // 记录编辑界面的宽度
            height: 0, // 记录编辑界面的高度
        },
        guidelines: {
            // moveable 标尺辅助线
            verticalGuidelines: [],
            horizontalGuidelines: [],
        },
        dCurrentPage: 0,
        dPage: pageDefault
    }),
    getters: {
    // getDPage() {
    //   const widgetStore = useWidgetStore()
    //   return widgetStore.dLayouts[this.dCurrentPage].global
    // },
    },
    actions: {
        /** 更新画布缩放百分比 */
        updateZoom(zoom) {
            this.dZoom = zoom;
        },
        /** 更新画布垂直居中修正值 */
        updatePaddingTop(num) {
            this.dPaddingTop = num;
        },
        /** 更新编辑界面的宽高 */
        updateScreen({ width, height }) {
            this.dScreen.width = width;
            this.dScreen.height = height;
        },
        /** 修改标尺线 */
        updateGuidelines(lines) {
            this.guidelines = { ...this.guidelines, ...lines };
        },
        /** 强制重绘画布 */
        reChangeCanvas() {
            // const tag = this.dPage.tag
            // this.dPage.tag = tag === 0 ? 0.01 : 0
        },
        /** 更新 Page 字段 */
        updatePageData({ key, value }) {
            const data = this.dPage;
            if (data[key] !== value) {
                data[key] = value;
            }
        },
        /** 获取 Page */
        getDPage() {
            const widgetStore = useWidgetStore();
            return widgetStore.dLayouts[this.dCurrentPage].global;
        },
        /** 设置 Page */
        setDPage(data) {
            if (data?.name) {
                data.name = repairKnownMojibake(data.name);
            }
            this.dPage = data;
            this.updateDPage();
            // const cur = this.dPage
            // const keys = Object.keys(data) as (keyof TPageState)[];
            // keys.forEach(val => {
            //   cur[val] = data[val]
            // })
        },
        /** 更新 Page（layouts）*/
        updateDPage() {
            const widgetStore = useWidgetStore();
            widgetStore.dLayouts[this.dCurrentPage].global = this.dPage;
            // const cur = this.dPage
            // const keys = Object.keys(data) as (keyof TPageState)[];
            // keys.forEach(val => {
            //   cur[val] = data[val]
            // })
        },
        /** 设置底部工具栏高度 */
        setBottomHeight(h) {
            this.dBottomHeight = h;
        },
        /** 更新当前页面下标 */
        setDCurrentPage(n) {
            this.dCurrentPage = n;
        }
    }
});
export default CanvasStore;
//# sourceMappingURL=index.js.map