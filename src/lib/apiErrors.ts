export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class DatabaseUnavailableError extends ApiError {
  constructor() {
    super('Layanan database sedang tidak tersedia. Silakan coba lagi.', 503);
    this.name = 'DatabaseUnavailableError';
  }
}

export function apiErrorResponse(error: unknown, message: string): Response {
  const known = error instanceof ApiError;
  if (!known) console.error('[API]', message, error);
  return Response.json({ error: known ? error.message : message }, {
    status: known ? error.status : 500,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
