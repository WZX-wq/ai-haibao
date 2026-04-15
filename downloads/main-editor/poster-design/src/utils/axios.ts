/*
 * @Author: ShawnPhang
 * @Date: 2021-07-13 02:48:38
 * @Description: 本地测试用户身份写死
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-03 20:56:23
 */
import axios, { AxiosRequestConfig, AxiosResponse, AxiosStatic } from 'axios'
import app_config, { LocalStorageKey } from '@/config.ts'
import { useBaseStore, useUserStore } from '@/store/index.ts';

axios.defaults.timeout = 240000
// axios.defaults.headers.authorization = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MTAwMDEsImV4cCI6MTc4ODU3NDc1MDU4NX0.L_t6DFD48Dm6rUPfgIgOWJkz18En1m_-hhMHcpbxliY';
const defaultToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MTAwMDEsImV4cCI6MTc4ODU3NDc1MDU4NX0.L_t6DFD48Dm6rUPfgIgOWJkz18En1m_-hhMHcpbxliY';
// const version = app_config.VERSION;
const baseUrl = app_config.API_URL

// 请求拦截器
axios.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const url = config.url ?? ""
    const values = {}
    if (url.includes('ai/poster/')) {
      config.timeout = Math.max(config.timeout || 0, 240000)
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      config.url = url.startsWith('/') ? baseUrl + url : config.url = baseUrl + '/' + url
    }

    if (config.method === 'get') {
      //  config.params = utils.extend(config.params, values)
      config.params = Object.assign(config.params, values)
      // config.params = qs.stringify(config.params);
    } else {
      config.data = Object.assign(config.data, values)
      //  config.data = utils.extend(config.data, values)
      // config.data = qs.stringify(config.data);
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// 响应拦截器
axios.interceptors.response.use((res: AxiosResponse<any>) => {
    // store.dispatch('hideLoading');
    // 接口规则：只有正确code为200时返回result结果对象，错误返回整个结果对象
    if (!res.data) {
      return Promise.reject(res)
    }
    if (res.data.code === 401) {
      console.log('登录失效')
      useUserStore().changeOnline(false)
      // store.commit('changeOnline', false)
    }

    if (res.data.result && res.data.code === 200) {
      return Promise.resolve(res.data.result)
    } else if (res.data.data && res.data.stat == 1) {
      return Promise.resolve(res.data.data)
    } else {
      return Promise.resolve(res.data)
    }
  },
  (error) => {
    // if (error.response.status === 401) {
    // }
    useBaseStore().hideLoading()
    // store.dispatch('hideLoading')
    return Promise.reject(error)
  },
)

type TFetchRequestConfigParams = AxiosRequestConfig & Record<string, any>
type TFetchMethod = keyof Pick<
  AxiosStatic, 
  "get" | "post" | "put" | "getUri" | "request" | "delete" | "head" | "options" | "patch"
>

const normalizeAxiosPayload = (payload: any) => {
  if (!payload) return payload
  const isAxiosResponse =
    !!payload &&
    typeof payload === 'object' &&
    ('config' in payload) &&
    ('headers' in payload) &&
    ('status' in payload)
  const data = isAxiosResponse ? payload?.data : (payload?.response?.data ?? payload)

  if (data?.code === 401) {
    console.log('鐧诲綍澶辨晥')
    useUserStore().changeOnline(false)
  }

  if (data?.result && data?.code === 200) {
    return data.result
  }

  if (data?.data && data?.stat == 1) {
    return data.data
  }

  return data
}

const isBusinessPayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return false
  const keys = Object.keys(payload)
  if (!keys.length) return false
  const systemErrorKeys = ['message', 'name', 'stack', 'config', 'request', 'response', 'isAxiosError']
  if (keys.every((key) => systemErrorKeys.includes(key))) return false
  return [
    'code',
    'stat',
    'result',
    'data',
    'list',
    'page',
    'pageSize',
    'total',
    'provider_name',
    'oauth_ready',
    'mysql_ready',
    'login_url',
    'local_token',
    'account_overview',
    'quick_actions',
    'session_status',
  ].some((key) => key in payload)
}

// export default axios;
const fetch = <T = any> (
  url: string,
  params: TFetchRequestConfigParams, 
  type: TFetchMethod = 'get',
  exheaders: Record<string, any> = {},
  extra: Record<string, any> = {}
): Promise<T> => {
  if (params?._noLoading) {
    delete params._noLoading
  } else {
    // store.commit('loading', '加载中..');
  }

  const token = localStorage.getItem(LocalStorageKey.tokenKey) || defaultToken
  const headerObject: Record<string, any> = {}
  token && (headerObject.Authorization = token)
  
  if (type === 'get') {
    return axios.get(url, {
      headers: Object.assign(headerObject, exheaders),
      params,
      ...extra,
    })
      .then((response) => normalizeAxiosPayload(response) as T)
      .catch((error) => {
        const normalized = normalizeAxiosPayload(error)
        if (isBusinessPayload(normalized)) {
          return normalized as T
        }
        return Promise.reject(error)
      })
  } else {
    return axios[type](url, params, {
      headers: Object.assign(headerObject, exheaders),
      ...extra,
    })
      .then((response) => normalizeAxiosPayload(response) as T)
      .catch((error) => {
        const normalized = normalizeAxiosPayload(error)
        if (isBusinessPayload(normalized)) {
          return normalized as T
        }
        return Promise.reject(error)
      }) as Promise<T>
  }
}

export default fetch
