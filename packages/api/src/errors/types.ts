export interface ApiClientError extends Error {
  status?: number;
  details?: unknown;
}

export interface ApiClientCaptureContext {
  source: string;
  endpoint: string;
  method: string;
  status?: number;
}
