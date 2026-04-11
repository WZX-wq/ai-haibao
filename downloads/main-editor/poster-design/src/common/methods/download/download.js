/*
 * @Author: ShawnPhang
 * @Date: 2021-09-30 15:52:59
 * @Description: 下载远程图片
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 17:01:59
 */
export default (src, cb, fileName) => {
    return new Promise((resolve) => {
        fetchImageDataFromUrl(src, (progress, xhr) => {
            cb(progress, xhr);
        }).then((res) => {
            const reader = new FileReader();
            reader.onload = function (event) {
                const a = document.createElement('a');
                const mE = new MouseEvent('click');
                const suffix = res.type ? res.type.split('/')[1] : 'png';
                const randomName = String(new Date().getTime()) + `.${suffix || 'png'}`;
                a.download = fileName || randomName;
                a.href = event?.target?.result;
                // 触发a的单击事件
                a.dispatchEvent(mE);
                resolve(res);
            };
            if (!res) {
                resolve();
                return;
            }
            reader.readAsDataURL(res);
        });
    });
};
function fetchImageDataFromUrl(url, cb) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        let totalLength = '';
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.onreadystatechange = function () {
            totalLength = Number(xhr.getResponseHeader('content-length')); // 'cache-control'
        };
        xhr.onprogress = function (event) {
            cb((event.loaded / Number(totalLength)) * 100, xhr);
        };
        xhr.onload = function () {
            if (xhr.status < 400)
                resolve(this.response);
            else
                resolve(null);
        };
        xhr.onerror = function (e) {
            resolve(null);
        };
        xhr.send();
    });
}
//# sourceMappingURL=download.js.map