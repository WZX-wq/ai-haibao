/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-04 18:10:00
 * @Description:
 * @LastEditors: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @Date: 2024-03-04 18:10:00
 */
import { CornerDotType, Options } from 'qr-code-styling'
import type { TQrcodeProps } from './types'

export function generateOption(props: TQrcodeProps): Options {
  const color = props.dotsOptions?.color || '#35495E'
  return {
    width: props.width,
    height: props.height,
    type: 'canvas',
    data: props.value,
    image: props.image,
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
      ...props.dotsOptions,
    },
    cornersSquareOptions: {
      color,
    },
    cornersDotOptions: {
      color,
      type: 'square' as CornerDotType,
    },
  }
}
