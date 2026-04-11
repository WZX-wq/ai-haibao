import fetch from '@/utils/axios';
import _config from '@/config';
export const generatePoster = (params) => fetch('ai/poster/generate', params, 'post');
export const generateCopy = (params) => fetch('ai/poster/copy', params, 'post');
export const generatePalette = (params) => fetch('ai/poster/palette', params, 'post');
export const generateBackground = (params) => fetch('ai/poster/background', params, 'post');
export const replacePosterImage = (params) => fetch('ai/poster/replace-image', params, 'post');
export const relayoutPoster = (params) => fetch('ai/poster/relayout', params, 'post');
export const cutoutImage = (file, cb) => {
    const formData = new FormData();
    formData.append('file', file);
    const extra = {
        responseType: 'json',
        onUploadProgress: (progress) => {
            cb?.(Math.floor((progress.loaded / progress.total) * 100), 0);
        },
        onDownloadProgress: (progress) => {
            cb?.(100, Math.floor((progress.loaded / progress.total) * 100));
        },
    };
    return fetch('ai/poster/cutout', formData, 'post', {}, extra);
};
export const upload = (file, cb, folder = 'user') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const extra = {
        responseType: 'json',
        onUploadProgress: (progress) => {
            cb?.(Math.floor((progress.loaded / progress.total) * 100), 0);
        },
        onDownloadProgress: (progress) => {
            cb?.(100, Math.floor((progress.loaded / progress.total) * 100));
        },
    };
    return fetch(`${_config.SCREEN_URL}/api/file/upload`, formData, 'post', {}, extra);
};
//# sourceMappingURL=ai.js.map