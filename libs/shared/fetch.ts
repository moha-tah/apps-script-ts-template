/**
 * HTTP helpers around UrlFetchApp.
 *
 * The trap they exist for: `muteHttpExceptions: true` makes UrlFetchApp stop
 * throwing on 4xx/5xx. Without it you cannot read an error body — with it, a
 * failed call looks exactly like a successful one unless you check the status
 * code yourself. Scripts that skip that check report success while silently
 * doing nothing. These helpers always check.
 */
import { withRetry, type RetryOptions } from './retry'

export interface FetchOptions
  extends GoogleAppsScript.URL_Fetch.URLFetchRequestOptions {
  /** Retry transient failures (429 and 5xx). Off by default. */
  retry?: RetryOptions
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string
  ) {
    super(`${status} from ${url}: ${body.slice(0, 500)}`)
    this.name = 'HttpError'
  }
}

/** Fetches a URL and throws HttpError on any non-2xx response. */
export function fetchOk(
  url: string,
  options: FetchOptions = {}
): GoogleAppsScript.URL_Fetch.HTTPResponse {
  const { retry, ...requestOptions } = options

  const attempt = () => {
    const response = UrlFetchApp.fetch(url, {
      ...requestOptions,
      muteHttpExceptions: true,
    })
    const status = response.getResponseCode()
    if (status < 200 || status >= 300) {
      throw new HttpError(status, url, response.getContentText())
    }
    return response
  }

  return retry ? withRetry(attempt, retry) : attempt()
}

/** Same as fetchOk, parsed as JSON. */
export function fetchJson<T>(url: string, options: FetchOptions = {}): T {
  return JSON.parse(fetchOk(url, options).getContentText()) as T
}

/** POSTs a JSON body and returns the parsed JSON response (or null if empty). */
export function postJson<T>(
  url: string,
  payload: unknown,
  options: FetchOptions = {}
): T | null {
  const response = fetchOk(url, {
    ...options,
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
  })
  const text = response.getContentText()
  return text ? (JSON.parse(text) as T) : null
}
