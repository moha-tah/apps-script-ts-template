/**
 * Retries with backoff — Apps Script's most reused utility.
 *
 * Google's own APIs are eventually consistent (a freshly created Workspace user
 * 404s for a few seconds), and external endpoints rate-limit the shared Apps
 * Script egress IPs. Both fail transiently and succeed on a second attempt.
 */

export interface RetryOptions {
  /** Total attempts, including the first one. Default 3. */
  attempts?: number
  /** Delay before the second attempt, in ms. Default 1000. */
  delayMs?: number
  /** Multiplier applied to the delay after each failure. Default 2. */
  backoff?: number
  /** Called before each retry — log here. */
  onRetry?: (error: unknown, attempt: number) => void
}

/** Blocks the execution. Uses Utilities.sleep in Apps Script, busy-waits locally. */
export function sleep(ms: number): void {
  if (typeof Utilities !== 'undefined') {
    Utilities.sleep(ms)
    return
  }
  const until = Date.now() + ms
  while (Date.now() < until) {
    /* Apps Script has no async/await in triggers — a blocking wait is the norm. */
  }
}

/**
 * Runs `operation`, retrying on throw. Re-throws the last error when all
 * attempts fail, so callers decide whether a failure is fatal.
 */
export function withRetry<T>(
  operation: () => T,
  options: RetryOptions = {}
): T {
  const { attempts = 3, delayMs = 1000, backoff = 2, onRetry } = options
  let wait = delayMs
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return operation()
    } catch (error) {
      lastError = error
      if (attempt === attempts) break
      onRetry?.(error, attempt)
      sleep(wait)
      wait *= backoff
    }
  }

  throw lastError
}
