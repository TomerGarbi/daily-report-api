/**
 * httpClient.ts
 *
 * Small, dependency-free helper for making outbound HTTP requests with:
 *  - a bounded timeout (via AbortController)
 *  - capped exponential-backoff retry for network errors and 5xx responses
 *  - automatic propagation of the caller's `X-Request-Id` for log correlation
 *
 * Do NOT use this for calling the DailyReport API itself — use direct
 * mongoose / service calls. This is for OUTBOUND third-party integrations
 * (weather, energy, Active Directory over HTTP, etc.).
 */

import { logger } from "./loggerService";

export interface FetchWithResilienceOptions {
  /** Milliseconds before the request is aborted. Default 10_000. */
  timeoutMs?: number;
  /** Maximum retry attempts (in addition to the initial call). Default 2. */
  retries?: number;
  /** Initial backoff delay in ms; doubles each retry, capped at 10s. Default 300. */
  backoffMs?: number;
  /** Optional request-id to propagate as `X-Request-Id`. */
  requestId?: string;
  /** Logical name of the upstream service, used in log messages. */
  serviceName?: string;
  /** Additional headers to merge in. `X-Request-Id` is added automatically when `requestId` is set. */
  headers?: Record<string, string>;
  /** HTTP method. Default GET. */
  method?: string;
  /** Optional body (only sensible for non-GET). */
  body?: BodyInit;
}

/** True for network-level errors and 5xx responses that are worth retrying. */
function isRetryable(err: unknown, status?: number): boolean {
  if (status !== undefined) return status >= 500 && status < 600;
  // Network / abort / TypeError from fetch
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout + retry. Returns the `Response` on success (any status
 * code the caller wants to inspect); throws only on network failure, timeout,
 * or after all retries have been exhausted.
 *
 * Callers should still check `res.ok` and handle 4xx explicitly — those are
 * NOT retried, since retrying a validation error will just fail again.
 */
export async function fetchWithResilience(
  url: string,
  options: FetchWithResilienceOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 10_000,
    retries = 2,
    backoffMs = 300,
    requestId,
    serviceName = "externalService",
    headers = {},
    method = "GET",
    body,
  } = options;

  const finalHeaders: Record<string, string> = { ...headers };
  if (requestId && !finalHeaders["X-Request-Id"]) {
    finalHeaders["X-Request-Id"] = requestId;
  }

  let lastError: unknown;
  const totalAttempts = retries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const init: RequestInit = {
        method,
        headers: finalHeaders,
        signal: controller.signal,
      };
      if (body !== undefined) init.body = body;
      const res = await fetch(url, init);

      // 5xx → treat as retryable; 4xx → return as-is for caller to handle.
      if (!res.ok && isRetryable(undefined, res.status)) {
        if (attempt < totalAttempts) {
          const delay = Math.min(backoffMs * 2 ** (attempt - 1), 10_000);
          logger.warn(
            `Upstream ${serviceName} returned ${res.status}; retrying in ${delay}ms`,
            serviceName,
            { url, status: res.status, attempt, requestId },
          );
          await sleep(delay);
          continue;
        }
      }
      return res;
    } catch (err) {
      lastError = err;
      const aborted = (err as { name?: string }).name === "AbortError";
      const message = aborted
        ? `Upstream ${serviceName} timed out after ${timeoutMs}ms`
        : `Upstream ${serviceName} request failed`;

      if (attempt < totalAttempts && isRetryable(err)) {
        const delay = Math.min(backoffMs * 2 ** (attempt - 1), 10_000);
        logger.warn(
          `${message}; retrying in ${delay}ms`,
          serviceName,
          {
            url,
            attempt,
            requestId,
            error: err instanceof Error ? err.message : String(err),
          },
        );
        await sleep(delay);
        continue;
      }

      // Out of retries — rethrow with context.
      logger.error(message, serviceName, {
        url,
        attempts: attempt,
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  // Unreachable in practice — the loop above returns or throws.
  throw lastError ?? new Error(`fetchWithResilience: exhausted retries for ${url}`);
}
