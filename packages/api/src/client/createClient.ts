export const buildQueryParams = (filters: Record<string, unknown> = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed === 'undefined' || trimmed === 'null') continue;
      params.append(key, trimmed);
      continue;
    }

    params.append(key, String(value));
  }
  return params;
};

const defaultShouldCaptureError = (error: { status?: number; message?: string } | null | undefined) => {
  const message = String(error?.message || '');
  if (error?.status === 401) return false;
  if (/not authenticated/i.test(message)) return false;
  return true;
};

export interface CreateApiClientOptions {
  baseUrl: string;
  getAuthToken?: () => string | null | undefined;
  onUnauthorized?: (error: { status?: number; message?: string; details?: unknown }) => void | Promise<void>;
  captureError?: (error: unknown, context: { source: string; endpoint: string; method: string; status?: number }) => void;
  shouldCaptureError?: (error: { status?: number; message?: string } | null | undefined) => boolean;
}

export class APIClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: () => string | null | undefined;
  private readonly onUnauthorized?: CreateApiClientOptions['onUnauthorized'];
  private readonly captureError?: CreateApiClientOptions['captureError'];
  private readonly shouldCaptureError: NonNullable<CreateApiClientOptions['shouldCaptureError']>;

  constructor(options: CreateApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.getAuthToken = options.getAuthToken || (() => null);
    this.onUnauthorized = options.onUnauthorized;
    this.captureError = options.captureError;
    this.shouldCaptureError = options.shouldCaptureError || defaultShouldCaptureError;
  }

  buildQueryParams(filters: Record<string, unknown> = {}) {
    return buildQueryParams(filters);
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const method = String(options.method || 'GET').toUpperCase();
    const maxAttempts = method === 'GET' ? 2 : 1;

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...((options.headers as Record<string, string>) || {}),
    };
    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (response.status === 204) {
          return null;
        }

        let data;
        try {
          data = await response.json();
        } catch {
          data = { error: `API error: ${response.status}` };
        }

        if (!response.ok) {
          const message = data.message || data.error || `API error: ${response.status}`;
          const err = new Error(message) as Error & { status?: number; details?: unknown };
          err.status = response.status;
          err.details = data;

          if (response.status === 401 && this.onUnauthorized) {
            await this.onUnauthorized(err);
          }

          if (this.shouldCaptureError(err)) {
            this.captureError?.(err, {
              source: 'apiClient.request',
              endpoint,
              status: response.status,
              method,
            });
          }
          throw err;
        }

        return data;
      } catch (error) {
        const errorMessage = String((error as { message?: string })?.message || '').toLowerCase();
        const isNetworkLoadFailure =
          error instanceof TypeError &&
          (errorMessage.includes('load failed') || errorMessage.includes('failed to fetch') || errorMessage.includes('networkerror'));
        const shouldRetry = isNetworkLoadFailure && attempt < maxAttempts;

        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          continue;
        }

        if (this.shouldCaptureError(error as { status?: number; message?: string })) {
          this.captureError?.(error, {
            source: 'apiClient.request.catch',
            endpoint,
            method,
          });
        }
        throw error;
      }
    }

    throw new Error('Unexpected request retry failure');
  }
}

export const createApiClient = (options: CreateApiClientOptions) => new APIClient(options);
