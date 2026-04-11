/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-17 15:00:00
 * @Description: User全局状态管理
 * @LastEditors: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-03-18 21:00:00
 */
import { defineStore } from "pinia";
/** User全局状态管理 */
const useUserStore = defineStore('userStore', {
    state: () => ({
        online: true, // 登录状态，
        user: {
            name: localStorage.getItem('username'),
        }, // 储存用户信息
        manager: '', // 是否为管理员模式
        tempEditing: false, // 管理员是否正在编辑模板
    }),
    actions: {
        changeOnline(status) {
            this.online = status;
        },
        changeUser(name) {
            this.user.name = name;
            // state.user = Object.assign({}, state.user)
            // state.user = { ...state.user }
            localStorage.setItem('username', name);
        },
        managerEdit(status) {
            this.tempEditing = status;
        },
    }
});
export default useUserStore;
//# sourceMappingURL=user.js.map