// Client-side helper: attaches the double-submit CSRF token to mutating fetches.
export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)fan26_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function secureFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('x-csrf-token', getCsrfToken());
  }
  return fetch(input, { ...init, headers });
}
