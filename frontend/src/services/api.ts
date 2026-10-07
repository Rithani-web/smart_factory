import type { ApiErrorBody, ErrorCode } from '@smart-factory/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode | 'UNKNOWN',
    message: string,
  ) {
    super(message);
  }
}

/** Typed fetch wrapper — cookies ride along (httpOnly session), responses are
 * typed ONLY via @smart-factory/types (Constitution III). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    let code: ErrorCode | 'UNKNOWN' = 'UNKNOWN';
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error.code;
      message = body.error.message;
    } catch {
      // keep defaults
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
