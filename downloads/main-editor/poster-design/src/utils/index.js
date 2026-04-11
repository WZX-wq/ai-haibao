import * as services from '../api/index';
import * as utils from './utils';
import _config from '@/config';
import modules from './plugins/modules';
import cssLoader from './plugins/cssLoader';
export default {
    install(myVue) {
        modules(myVue);
        cssLoader(_config.ICONFONT_EXTRA);
        cssLoader(_config.ICONFONT_URL);
        myVue.config.globalProperties.$ajax = services;
        myVue.config.globalProperties.$utils = utils;
    },
};
//# sourceMappingURL=index.js.map