/*
 * @Author: ShawnPhang
 * @Date: 2023-07-12 19:37:14
 * @Description: 下载 base64
 * @LastEditors: ShawnPhang <site: book.palxp.com>
 * @LastEditTime: 2023-07-12 19:37:39
 */
async function toDownloadUrl(source) {
    if (!source)
        return '';
    if (source.startsWith('blob:'))
        return source;
    const response = await fetch(source);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}
export default async (base64Data, fileName) => {
    const downloadUrl = await toDownloadUrl(base64Data);
    if (!downloadUrl)
        return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    requestAnimationFrame(() => {
        link.remove();
        if (downloadUrl.startsWith('blob:')) {
            URL.revokeObjectURL(downloadUrl);
        }
    });
};
//# sourceMappingURL=downloadBase64File.js.map
