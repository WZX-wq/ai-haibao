/*
 * @Author: ShawnPhang
 * @Date: 2021-08-19 18:43:22
 * @Description:
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-16 15:37:54
 */
import fetch from '@/utils/axios';
import _config from '@/config';
function serialize(obj) {
    return Object.keys(obj).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`).join('&');
}
// const screenshot_url = window.location.protocol + '//' + window.location.host + '/draw'
export const download = (params = {}) => `${_config.SCREEN_URL}/api/screenshots?${serialize(params)}`;
// 获取模板列表
export const getTempList = (params) => fetch('design/list', params, 'get');
export const getTempDetail = (params) => fetch('design/temp', params, 'get');
export const getCategories = (params) => fetch('design/cate', params, 'get');
// 保存模板
export const saveTemp = (params = {}) => fetch('design/edit', params, 'post');
// 组件相关接口
export const getCompList = (params) => fetch('design/list', params, 'get');
export const removeComp = (params) => fetch('design/del', params, 'post');
// 保存作品
export const saveWorks = (params) => fetch('design/save', params, 'post');
// 保存个人模板
export const saveMyTemp = (params = {}) => fetch('design/user/temp', params, 'post');
// 获取作品
export const getWorks = (params) => fetch('design/poster', params, 'get');
// 作品列表
export const getMyDesign = (params) => fetch('design/my', params, 'get');
//# sourceMappingURL=home.js.map