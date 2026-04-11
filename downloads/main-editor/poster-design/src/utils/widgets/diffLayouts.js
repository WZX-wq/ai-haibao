/*
 * @Author: ShawnPhang
 * @Date: 2023-09-14 11:33:44
 * @Description: 依赖不能直接引入，所以暂时不使用WebWorker
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-19 03:07:18
 */
import diff from 'microdiff';
import { produce, applyPatches, enablePatches } from 'immer';
enablePatches();
const ops = {
    CHANGE: 'replace',
    CREATE: 'add',
    REMOVE: 'remove',
};
let cloneData = '';
export default class {
    notifi;
    constructor() { }
    /**
     * onmessage
     */
    onmessage(cb) {
        this.notifi = cb;
    }
    postMessage(e) {
        if (!e)
            return;
        if (e.op === 'done') {
            if (!cloneData)
                return;
            let fork = JSON.parse(cloneData);
            let curArray = JSON.parse(e.data);
            // 比较数据差异
            let diffData = diff(fork, curArray);
            // 生成差分补丁
            fork = produce(fork, (draft) => {
                for (const d of diffData) {
                    d.op = ops[d.type];
                }
                draft = applyPatches(draft, diffData);
            }, (patches, inversePatches) => {
                this.notifi({ patches, inversePatches });
            });
            cloneData = '';
        }
        else
            cloneData = e.data;
    }
}
//# sourceMappingURL=diffLayouts.js.map