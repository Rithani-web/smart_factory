/** Uniform error shape for every non-2xx response (research D9, FR-016). */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

/** Well-known error codes used by contract tests. */
export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  NOT_ASSIGNED: 'NOT_ASSIGNED',
  MUST_ACKNOWLEDGE_FIRST: 'MUST_ACKNOWLEDGE_FIRST',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface HealthResponse {
  status: 'ok';
}
