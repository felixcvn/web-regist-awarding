// Cloudflare Turnstile verification (optional, enabled by setting
// TURNSTILE_SECRET_KEY). Keeping it env-gated lets the app run locally without
// external calls while production can turn bot protection on without code changes.
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    // Fail closed: if verification cannot be completed, reject the submission.
    return false;
  }
}
