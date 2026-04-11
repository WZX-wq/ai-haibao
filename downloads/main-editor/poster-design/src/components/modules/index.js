function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
// 排除要全局引入的组件,可以是目录名也可以是文件名
const exclude = ['settings', 'layout'];
const regex = RegExp('.*^(?!.*?(' + exclude.join('|') + ')).*\\.vue$');
// const requireComponent = require.context('.', true, /\.vue$/) // 找到components文件夹下以.vue命名的文件
const requireComponent = import.meta.glob('./**/*.vue', { eager: true });
function guide(Vue) {
    for (const fileName in requireComponent) {
        if (regex.test(fileName)) {
            const componentConfig = requireComponent[fileName];
            const componentName = capitalizeFirstLetter(fileName.replace(/^\..*\//, '').replace(/\.\w+$/, ''));
            Vue.component(componentName, componentConfig.default || componentConfig);
        }
    }
}
export default guide;
//# sourceMappingURL=index.js.map