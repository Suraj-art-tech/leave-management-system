export class AppError extends Error {
  readonly statusCode: number;
  readonly details: unknown;

  constructor(statusCode: number, message: string, details: unknown = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function successResponse<T>(data: T, correlationId: string | null) {
  return { success: true as const, data, correlationId };
}

export function errorResponse(message: string, correlationId: string | null, details: unknown = null) {
  return { success: false as const, error: { message, details }, correlationId };
}
