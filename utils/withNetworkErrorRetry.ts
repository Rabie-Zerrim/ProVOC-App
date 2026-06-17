// Retries a call exactly once if it fails with a transient network error
// (axios "Network Error" — no e.response at all). Real 4xx/5xx responses
// are not retried and propagate immediately.
export async function withNetworkErrorRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    if (e?.response !== undefined) throw e
    await new Promise((resolve) => setTimeout(resolve, 800))
    return await fn()
  }
}
