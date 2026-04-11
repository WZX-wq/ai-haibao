import api from '@/api';
import { getImage } from '@/common/methods/getImgDetail';
export const selectImageFile = async (state, raw, file, successCb, uploadCb) => {
    if (!raw.value)
        return;
    const objectUrl = URL.createObjectURL(file);
    state.rawImage = objectUrl;
    raw.value.addEventListener('load', () => {
        state.offsetWidth = raw.value.offsetWidth;
    }, { once: true });
    state.progressText = '正在上传...';
    state.progress = 0;
    const result = await api.ai.cutoutImage(file, (up, dp) => {
        uploadCb?.(up, dp);
        if (dp) {
            state.progressText = dp === 100 ? '' : '正在导入...';
            state.progress = dp;
        }
        else {
            state.progressText = up < 100 ? '正在上传...' : '正在处理，请稍候...';
            state.progress = up < 100 ? up : 0;
        }
    });
    state.progressText = '';
    state.progress = 0;
    successCb?.(result.resultUrl, file.name);
};
export async function uploadCutPhotoToCloud(cutImage) {
    try {
        const response = await fetch(cutImage);
        const buffer = await response.arrayBuffer();
        const file = new File([buffer], `cut_image_${Date.now()}.png`, { type: 'image/png' });
        const uploadRes = await api.ai.upload(file, undefined, 'user');
        const { width, height } = await getImage(file);
        await api.material.addMyPhoto({ width, height, url: uploadRes.url });
        return uploadRes.url;
    }
    catch (error) {
        console.error(`upload cut file error: ${error}`);
        return '';
    }
}
//# sourceMappingURL=method.js.map