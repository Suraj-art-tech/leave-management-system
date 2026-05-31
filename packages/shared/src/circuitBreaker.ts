import CircuitBreaker from 'opossum';
import { request, type Dispatcher } from 'undici';
import { AppError } from './errors.js';

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  correlationId?: string;
  token?: string;
}

const breakers = new Map<string, CircuitBreaker<[string, HttpRequestOptions], unknown>>();

function getBreaker(key: string): CircuitBreaker<[string, HttpRequestOptions], unknown> {
  if (!breakers.has(key)) {
    const breaker = new CircuitBreaker(
      async (url: string, options: HttpRequestOptions) => {
        const headers: Record<string, string> = {
          ...(options.headers ?? {}),
        };
        if (options.correlationId) headers['x-correlation-id'] = options.correlationId;
        if (options.token) headers.authorization = `Bearer ${options.token}`;

        const method = (options.method ?? 'GET').toUpperCase() as Dispatcher.HttpMethod;
        const hasBody = options.body !== undefined;
        if (hasBody) headers['content-type'] = 'application/json';

        const response = await request(url, {
          method,
          headers,
          body: hasBody ? JSON.stringify(options.body) : undefined,
        });

        const text = await response.body.text();
        let parsed: unknown = null;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
        }

        if (response.statusCode >= 400) {
          const errBody = parsed as { error?: { message?: string; details?: unknown } } | null;
          throw new AppError(
            response.statusCode,
            errBody?.error?.message ?? `HTTP ${response.statusCode}`,
            errBody?.error?.details ?? null
          );
        }

        return parsed;
      },
      {
        timeout: Number(process.env.HTTP_TIMEOUT ?? 5000),
        errorThresholdPercentage: Number(process.env.CB_ERROR_THRESHOLD ?? 50),
        resetTimeout: Number(process.env.CB_RESET_TIMEOUT ?? 10000),
        name: key,
        // Downstream 4xx responses are expected business/client errors, not
        // infrastructure failures. They must not trip the breaker or be masked
        // by the 503 fallback; propagate their original status code instead.
        errorFilter: (err: unknown) => err instanceof AppError && err.statusCode < 500,
      }
    );

    breaker.fallback(() => {
      throw new AppError(503, `Service "${key}" is unavailable (circuit breaker open)`);
    });

    breaker.on('open', () => console.warn(`[circuit-breaker] OPEN -> ${key}`));
    breaker.on('close', () => console.info(`[circuit-breaker] CLOSED -> ${key}`));

    breakers.set(key, breaker);
  }

  return breakers.get(key)!;
}

export async function httpRequest<T>(
  serviceKey: string,
  url: string,
  options: HttpRequestOptions = {}
): Promise<T> {
  return getBreaker(serviceKey).fire(url, options) as Promise<T>;
}
