/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-18 21:00:00
 * @Description: Store方法export
 * @LastEditors: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-03-28 14:00:00
 */
import { defineStore } from "pinia";
import { getCombined, initGroupJson, realCombined } from "./action";
const GroupStore = defineStore("groupStore", {
    state: () => ({
        dGroupJson: "" // 组合的json数据
    }),
    actions: {
        realCombined() { realCombined(this); },
        getCombined() { return getCombined(this); },
        initGroupJson(data) { initGroupJson(this, data); },
    }
});
export default GroupStore;
//# sourceMappingURL=index.js.map