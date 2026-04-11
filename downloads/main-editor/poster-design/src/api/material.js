/*
 * @Author: ShawnPhang <https://m.palxp.cn>
 * @Date: 2021-08-27 14:42:15
 * @Description: 媒体相关接口
 * @LastEditors: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-09-25 00:39:00
 */
import fetch from '@/utils/axios';
import _config from '@/config';
// 获取素材分类：
export const getKinds = (params = {}) => fetch('design/cate', params);
// 获取素材列表：
export const getList = (params) => fetch('design/material', params);
// 获取字体
export const getFonts = (params = {}) => fetch('design/fonts', params);
export const getFontSub = (params, extra = {}) => fetch('design/font_sub', params, 'get', {}, extra);
// 图库列表
export const getImagesList = (params) => fetch('design/imgs', params, 'get');
// 我的上传列表
export const getMyPhoto = (params) => fetch('design/user/image', params);
export const deleteMyPhoto = (params) => fetch('design/user/image/del', params, 'post');
export const deleteMyWorks = (params) => fetch('design/poster/del', params, 'post');
// 添加图片
export const addMyPhoto = (params) => fetch('design/user/add_image', params);
// 上传接口
export const upload = ({ file, folder = 'user' }, cb) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const extra = {
        responseType: 'json',
        onUploadProgress: (progress) => {
            cb(Math.floor((progress.loaded / progress.total) * 100), 0);
        },
        onDownloadProgress: (progress) => {
            cb(100, Math.floor((progress.loaded / progress.total) * 100));
        },
    };
    return fetch(`${_config.SCREEN_URL}/api/file/upload`, formData, 'post', {}, extra);
};
//# sourceMappingURL=material.js.map