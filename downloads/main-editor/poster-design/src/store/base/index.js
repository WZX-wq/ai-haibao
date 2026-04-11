/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-17 15:00:00
 * @Description: Base鍏ㄥ眬鐘舵€佺鐞? * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-08 17:00:12
 */
import { defineStore } from 'pinia';
import _config from '@/config';
/** Base鍏ㄥ眬鐘舵€佺鐞?*/
const useBaseStore = defineStore('base', {
    state: () => ({
        loading: null,
        watermark: _config.APP_NAME,
        fonts: [], // 缂撳瓨瀛椾綋鍒楄〃
    }),
    actions: {
        /** 闅愯棌loading */
        hideLoading() {
            setTimeout(() => {
                this.loading = false;
            }, 600);
        },
        setFonts(list) {
            this.fonts = list;
        },
        changeWatermark(wm) {
            this.watermark = wm;
        }
    }
});
export default useBaseStore;
//# sourceMappingURL=index.js.map
