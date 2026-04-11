/*
 * @Author: ShawnPhang
 * @Date: 2021-09-30 16:28:40
 * @Description: 弹出提示
 * @LastEditors: ShawnPhang
 * @LastEditTime: 2022-01-20 18:19:20
 */
import { ElNotification } from 'element-plus';
export default (title, message = '', extra) => {
    ElNotification({
        title,
        message,
        ...extra,
    });
};
//# sourceMappingURL=notification.js.map