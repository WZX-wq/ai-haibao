/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-18 21:00:00
 * @Description:
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 09:28:41
 */
import { defineStore } from 'pinia';
import { pushColorToHistory } from './actions/pushHistory';
import handleHistory from './actions/handleHistory';
/** 历史记录Store */
const HistoryStore = defineStore('historyStore', {
    state: () => ({
        dHistory: [],
        dHistoryParams: {
            index: -1,
            length: 0,
            maxLength: 20,
            stackPointer: -1
        },
        dHistoryStack: {
            changes: [],
            inverseChanges: [],
        },
        dColorHistory: [],
        dPageHistory: [],
    }),
    actions: {
        changeHistory({ patches, inversePatches }) {
            const pointer = ++this.dHistoryParams.stackPointer;
            // 如若之前撤销过，当新增记录时，后面的记录就清空了
            this.dHistoryStack.changes.length = pointer;
            this.dHistoryStack.inverseChanges.length = pointer;
            this.dHistoryStack.changes[pointer] = patches;
            this.dHistoryStack.inverseChanges[pointer] = inversePatches;
        },
        handleHistory(action) {
            handleHistory(this, action);
            // TODO: 操作后如果当前选中元素还在，则应当保留选择框
            // widgetStore.setdActiveElement(pageStore.dPage)
        },
        pushColorToHistory(color) {
            pushColorToHistory(this, color);
        },
    },
});
export default HistoryStore;
//# sourceMappingURL=index.js.map