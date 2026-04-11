/** 生成二维码数据 */
export function generateOption(props) {
    return {
        width: props.width,
        height: props.height,
        type: 'canvas', // canvas svg
        data: props.value,
        image: props.image, // /favicon.svg
        margin: 0,
        qrOptions: {
            typeNumber: 3,
            mode: 'Byte',
            errorCorrectionLevel: 'M',
        },
        imageOptions: {
            hideBackgroundDots: true,
            imageSize: 0.4,
            margin: 6,
            crossOrigin: 'anonymous',
        },
        backgroundOptions: {
            color: '#ffffff',
        },
        dotsOptions: {
            // color: '#41b583',
            // type: 'rounded' as DotType,
            ...props.dotsOptions,
        },
        cornersSquareOptions: {
            color: props.dotsOptions?.color,
            // type: '',
            // type: 'extra-rounded' as CornerSquareType,
            // gradient: {
            //   type: 'linear', // 'radial'
            //   rotation: 180,
            //   colorStops: [{ offset: 0, color: '#25456e' }, { offset: 1, color: '#4267b2' }]
            // },
        },
        cornersDotOptions: {
            color: props.dotsOptions?.color,
            type: 'square',
            // gradient: {
            //   type: 'linear', // 'radial'
            //   rotation: 180,
            //   colorStops: [{ offset: 0, color: '#00266e' }, { offset: 1, color: '#4060b3' }]
            // },
        },
    };
}
//# sourceMappingURL=method.js.map