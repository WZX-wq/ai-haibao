const prefix = process.env;
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isDev = host === '127.0.0.1' || host === 'localhost';
const devDefaultApi = 'http://127.0.0.1:7001';
const envApiUrl = prefix.VITE_API_URL || prefix.API_URL || '';
const envScreenUrl = prefix.VITE_SCREEN_URL || prefix.SCREEN_URL || '';
const envImgUrl = prefix.VITE_IMG_URL || prefix.IMG_URL || '';
const screenBaseUrl = envScreenUrl || (isDev ? devDefaultApi : '');
import { version } from '../package.json';
export default {
    isDev,
    BASE_URL: isDev ? '/' : './',
    VERSION: version,
    APP_NAME: '鲲穹设计',
    COPYRIGHT: 'ShawnPhang - Design.pPalxp.cn',
    API_URL: envApiUrl || (isDev ? devDefaultApi : ''),
    SCREEN_URL: screenBaseUrl,
    IMG_URL: envImgUrl || (screenBaseUrl ? `${screenBaseUrl.replace(/\/$/, '')}/static/` : '/static/'),
    ICONFONT_URL: '//at.alicdn.com/t/font_2717063_ypy8vprc3b.css?display=swap',
    ICONFONT_EXTRA: '//at.alicdn.com/t/c/font_3228074_xojoer6zhp.css',
    QINIUYUN_PLUGIN: 'https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/qiniu-js/2.5.5/qiniu.min.js',
    supportSubFont: false,
};
export const LocalStorageKey = {
    tokenKey: 'xp_token',
};
//# sourceMappingURL=config.js.map
