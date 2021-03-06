import LogRocket from 'lib/logrocket'

export type ResponseError = {
  ok: false
  data?: unknown
  error: Error
  problem: string
}

export type ResponseOk = Response & {
  ok: true
  data: unknown
}

export type SafeResponse = ResponseError | ResponseOk

export const FETCH_ERROR = 'FETCH_ERROR'
export const NONE = 'NONE'
export const CLIENT_ERROR = 'CLIENT_ERROR'
export const SERVER_ERROR = 'SERVER_ERROR'
// const TIMEOUT_ERROR = 'TIMEOUT_ERROR'
// const CONNECTION_ERROR = 'CONNECTION_ERROR'
// const NETWORK_ERROR = 'NETWORK_ERROR'
const UNKNOWN_ERROR = 'UNKNOWN_ERROR'

// const TIMEOUT_ERROR_CODES = ['ECONNABORTED']
// const NODEJS_CONNECTION_ERROR_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET']

const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json;charset=UTF-8'
}

function getProblemFromResponse(res: Response): string {
  if (res.status >= 500) return SERVER_ERROR
  if (res.status >= 400 && res.status <= 499) return CLIENT_ERROR
  return UNKNOWN_ERROR
}

function getProblemFromError(_: Error): string {
  return FETCH_ERROR
}

async function getData(res: Response) {
  const type = res.headers.get('Content-Type') || ''
  if (type.indexOf('json') > -1) return res.json()
  if (type.indexOf('text') > -1) return {message: await res.text()}
  if (type.indexOf('octet-stream') > -1) return res.arrayBuffer()
  return {message: 'no content'}
}

function parseErrorMessageFromData(data: any): string {
  return data == null
    ? 'Error while fetching data.'
    : typeof data === 'string'
    ? data
    : typeof data === 'object' &&
      Object.prototype.hasOwnProperty.call(data, 'message')
    ? data.message
    : JSON.stringify(data)
}

async function safeParseResponse(res: Response): Promise<SafeResponse> {
  const data = await getData(res)
  if (res.ok) {
    return {
      ...res,
      ok: true,
      data
    }
  }
  return {
    ...res,
    ok: false,
    data,
    error: new Error(parseErrorMessageFromData(data)),
    problem: getProblemFromResponse(res)
  }
}

/**
 * Never throw errors. Always return a response.
 */
export async function safeFetch(
  url: string,
  options?: RequestInit
): Promise<SafeResponse> {
  try {
    const res = await fetch(url, options)
    return await safeParseResponse(res)
  } catch (e: unknown) {
    if (e instanceof Error) {
      LogRocket.captureException(e)
      // TODO parse error see: https://github.com/infinitered/apisauce/blob/master/lib/apisauce.ts
      return {
        error: e,
        ok: false,
        problem: getProblemFromError(e)
      }
    } else {
      return {
        error: new Error(JSON.stringify(e)),
        ok: false,
        problem: UNKNOWN_ERROR
      }
    }
  }
}

/**
 * Throw the response when using SWR.
 */
export const swrFetcher = (url: string) =>
  safeFetch(url).then((res) => {
    if (res.ok) return res.data
    else throw res
  })

/**
 * Safe DELETE
 */
export function safeDelete(url: string) {
  return safeFetch(url, {
    method: 'DELETE'
  })
}

/**
 * Simple GET
 */
export function getJSON(url: string) {
  return safeFetch(url, {headers: defaultHeaders})
}

/**
 * Simple POST
 */
export function postJSON(url: string, json: unknown) {
  return safeFetch(url, {
    body: JSON.stringify(json),
    headers: defaultHeaders,
    method: 'POST'
  })
}

/**
 * Simple PUT
 */
export function putJSON(url: string, json: unknown) {
  return safeFetch(url, {
    body: JSON.stringify(json),
    headers: defaultHeaders,
    method: 'PUT'
  })
}
