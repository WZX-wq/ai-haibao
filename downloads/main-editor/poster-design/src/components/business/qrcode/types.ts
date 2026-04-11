import type { Options } from 'qr-code-styling'

export type TQrcodeProps = {
  width?: number
  height?: number
  image?: string
  value?: string
  dotsOptions: Options['dotsOptions']
}
