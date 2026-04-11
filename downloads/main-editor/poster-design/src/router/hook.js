import config from '@/config';
const routeTitles = {
    Welcome: '\u6b22\u8fce\u9875',
    Home: '\u7f16\u8f91\u5668',
    Create: 'AI\u6d77\u62a5\u52a9\u624b',
    AiPoster: 'AI\u6d77\u62a5\u52a9\u624b',
    Draw: '\u753b\u677f\u9884\u89c8',
    Html: '\u5bfc\u51fa\u9884\u89c8',
    Psd: 'PSD \u5bfc\u5165',
};
function resolveTitle(route) {
    const routeName = route.name ? String(route.name) : '';
    const pageTitle = routeTitles[routeName];
    return pageTitle ? `${pageTitle} - ${config.APP_NAME}` : config.APP_NAME;
}
export default (router) => {
    router.beforeEach((to, _from, next) => {
        if (/\/http/.test(to.path) || /\/https/.test(to.path)) {
            const url = to.path.split('http')[1];
            window.location.href = `http${url}`;
        }
        else {
            next();
        }
    });
    router.afterEach((to) => {
        document.title = resolveTitle(to);
        window.scrollTo(0, 0);
    });
};
//# sourceMappingURL=hook.js.map
