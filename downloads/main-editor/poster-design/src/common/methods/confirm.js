/*
 * @Author: ShawnPhang
 * @Date: 2022-02-03 16:30:18
 * @Description: Type: success / info / warning / error
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-08 18:55:12
 */
import { ElMessageBox } from 'element-plus';
export default (title = '提示', message = '', type = 'success', extra) => {
    return new Promise((resolve) => {
        ElMessageBox.confirm(message, title, Object.assign({
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type,
        }, extra))
            .then(() => {
            resolve(true);
        })
            .catch(() => {
            resolve(false);
        });
    });
};
//# sourceMappingURL=confirm.js.map