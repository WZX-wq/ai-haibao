import useControlStore from '../../control';
import useHistoryStore from '../../history';
import useCanvasStore from '../../canvas';
// TODO: 选中元件与取消选中
export function selectWidget(store, { uuid }) {
    const controlStore = useControlStore();
    const pageStore = useCanvasStore();
    const historyStore = useHistoryStore();
    const alt = controlStore.dAltDown;
    const selectWidgets = store.dSelectWidgets;
    const widget = store.dWidgets.find((item) => item.uuid === uuid);
    if (alt) {
        if (!widget)
            return;
        if (uuid !== '-1' && widget.parent === '-1') {
            // && !widget.isContainer
            if (selectWidgets.length === 0) {
                if (store.dActiveElement && store.dActiveElement.uuid !== '-1') {
                    selectWidgets.push(store.dActiveElement);
                }
            }
            const index = selectWidgets.findIndex((item) => {
                return item.uuid === uuid;
            });
            // 如果已经存在则取消选择，否则加入选取
            if (index !== -1) {
                selectWidgets.splice(index, 1);
                if (selectWidgets.length === 0) {
                    store.dActiveElement = pageStore.dPage;
                }
            }
            else {
                selectWidgets.push(widget);
            }
            if (selectWidgets.length === 1) {
                store.dActiveElement = selectWidgets[0];
                store.dSelectWidgets = [];
            }
        }
        return;
    }
    store.dSelectWidgets = [];
    if (uuid === '-1') {
        store.dActiveElement = pageStore.dPage;
        const pageHistory = historyStore.dPageHistory;
        if (pageHistory.length === 0) {
            pageHistory.push(JSON.stringify(pageStore.dPage));
        }
        setTimeout(() => {
            store.dSelectWidgets = [];
        }, 10);
    }
    else {
        if (!widget)
            return;
        // store.state.dActiveElement = {}
        setTimeout(() => {
            store.dActiveElement = widget;
        }, 10);
    }
}
/** 多选元素 */
export function selectWidgetsInOut(store, { uuid }) {
    const pageStore = useCanvasStore();
    const selectWidgets = store.dSelectWidgets;
    const widget = store.dWidgets.find((item) => item.uuid === uuid);
    if (widget && uuid !== '-1' && widget.parent === '-1' && !widget.isContainer) {
        if (selectWidgets.length === 0) {
            if (store.dActiveElement && store.dActiveElement.uuid !== '-1') {
                selectWidgets.push(store.dActiveElement);
            }
        }
        const index = selectWidgets.findIndex((item) => {
            return item.uuid === uuid;
        });
        // 如果已经存在则取消选择，否则加入选取
        if (index !== -1) {
            selectWidgets.splice(index, 1);
            if (selectWidgets.length === 0) {
                store.dActiveElement = pageStore.dPage;
            }
        }
        else {
            selectWidgets.push(widget);
        }
        // if (selectWidgets.length === 1) {
        //   store.state.dActiveElement = selectWidgets[0]
        //   store.state.dSelectWidgets = []
        // }
    }
}
export function selectItem(state, { data, type }) {
    state.selectItem.data = data;
    state.selectItem.type = type;
}
//# sourceMappingURL=select.js.map