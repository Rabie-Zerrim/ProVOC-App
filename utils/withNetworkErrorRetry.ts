function isTimeoutError(e: any): boolean {
  return e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message ?? '')
}

// Retries a call exactly once if it fails with a transient network error
// (axios "Network Error" — no e.response at all). Real 4xx/5xx responses
// are not retried and propagate immediately.
//
// By default, timeouts (axios ECONNABORTED) are treated the same as any
// other no-response error and ARE retried — fine for fast endpoints where a
// timeout usually signals a flaky/dead connection. Pass
// { retryOnTimeout: false } for slow-but-legitimate long-running endpoints
// (e.g. Whisper transcription) where a timeout just means the request is
// inherently slow, not failing — retrying would only double an already-long
// wait for no benefit.
export async function withNetworkErrorRetry<T>(
  fn: () => Promise<T>,
  options?: { retryOnTimeout?: boolean },
): Promise<T> {
  const retryOnTimeout = options?.retryOnTimeout ?? true
  try {
    return await fn()
  } catch (e: any) {
    if (e?.response !== undefined) throw e
    if (!retryOnTimeout && isTimeoutError(e)) throw e
    await new Promise((resolve) => setTimeout(resolve, 800))
    return await fn()
  }
}
