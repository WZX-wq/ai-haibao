export function getErrorText(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const message = (raw as any).message
    if (typeof message === 'string') return message
  }
  return ''
}

export function isNetworkErrorText(raw: unknown): boolean {
  const text = getErrorText(raw).toLowerCase()
  return text.includes('network') || text.includes('timeout') || text.includes('err_connection_refused')
}

export function toFriendlyActionError(prefix: string, raw: unknown): string {
  const message = getErrorText(raw)
  const low = message.toLowerCase()
  if (message.includes('敏感词')) return message
  if (isNetworkErrorText(message)) return `${prefix}：网络异常，请稍后重试`
  if (low.includes('401') || low.includes('403') || low.includes('429') || low.includes('权限') || low.includes('额度')) {
    return `${prefix}：权限或额度不足，请检查账号状态`
  }
  return `${prefix}：服务繁忙，请稍后重试`
}

export function toFriendlyQuotaMessage(raw: unknown): string {
  const text = getErrorText(raw).toLowerCase()
  if (!text) return '今日下载次数已用完或下载权限未开通'
  if (text.includes('429') || text.includes('已用完') || text.includes('limit')) return '今日下载次数已用完，请明天再试'
  if (text.includes('401') || text.includes('403') || text.includes('权限')) return '当前账号暂无下载权限，请联系管理员开通'
  if (isNetworkErrorText(text)) return '网络异常，暂时无法下载，请稍后重试'
  return '暂时无法下载，请稍后重试'
}

export function toFriendlyLoginError(raw: unknown): string {
  const text = getErrorText(raw).toLowerCase()
  if (!text) return '登录暂时不可用，请稍后重试'
  if (text.includes('未配置') || text.includes('not configured')) return '当前暂未完成登录配置，请联系管理员'
  if (text.includes('oauth') || text.includes('callback') || text.includes('state')) return '登录校验未通过，请重新点击登录'
  if (isNetworkErrorText(text)) return '网络异常，请检查网络后重试'
  if (text.includes('地址') || text.includes('url')) return '登录服务暂时不可用，请稍后重试'
  return '登录暂时不可用，请稍后重试'
}

export function toFriendlyCallbackError(raw: unknown): string {
  const text = getErrorText(raw).toLowerCase()
  if (!text) return '登录没有完成，请重新登录'
  if (text.includes('授权') || text.includes('cancel') || text.includes('denied')) return '你已取消授权，请重新登录'
  if (text.includes('state') || text.includes('callback') || text.includes('参数')) return '登录校验失败，请重新登录'
  if (isNetworkErrorText(text)) return '网络异常，请稍后重试'
  return '登录没有完成，请重新登录'
}

export function toFriendlyCutoutError(raw: unknown): string {
  const text = getErrorText(raw).toLowerCase()
  if (!text) return '抠图失败，请稍后重试或更换图片'
  if (text.includes('401') || text.includes('登录')) return '请先登录后再使用智能抠图'
  if (text.includes('403') || text.includes('权限')) return '当前账号暂无抠图权限，请联系管理员开通'
  if (text.includes('429') || text.includes('次数') || text.includes('额度') || text.includes('limit')) return '今日 AI 次数已用完，请明天再试'
  if (text.includes('datainspection') || text.includes('读取源图失败') || text.includes('media resource')) return '读取图片失败，请重新上传后再试'
  if (text.includes('rembg') || text.includes('onnxruntime') || text.includes('no module named')) return '本地抠图模型暂未就绪，请稍后重试'
  if (text.includes('无法处理这张图片') || text.includes('处理校验')) return '这张图片暂时无法完成抠图，建议更换主体更清晰的图片重试'
  if (text.includes('cutout task timeout') || text.includes('task timeout')) return '本地抠图处理时间较长，请稍后再试'
  if (isNetworkErrorText(text)) return '网络异常，抠图失败，请稍后重试'
  if (text.includes('格式')) return '当前图片格式暂不支持抠图，请更换 PNG/JPG/WebP 后重试'
  return '抠图失败，请稍后重试或更换图片'
}
