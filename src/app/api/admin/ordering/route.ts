import { verifyAdminAuth } from '@/lib/auth';
import { getOrderingSettings, updateOrderingSettings } from '@/lib/db';
import { validateCsrf, validateOrigin } from '@/lib/csrf';
import { apiErrorResponse } from '@/lib/apiErrors';
import { readJsonBody } from '@/lib/requestBody';
import { orderingSettingsUpdateSchema } from '@/lib/validation';
import { getClientIp, rateLimit, rateLimitResponse } from '@/lib/ratelimit';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  try {
    if (!await verifyAdminAuth()) return Response.json({ error: 'Akses ditolak.' }, { status: 401, headers });
    return Response.json(await getOrderingSettings(), { headers });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal memuat pengaturan Pemesanan.');
  }
}

export async function PATCH(request: Request) {
  try {
    if (!await verifyAdminAuth()) return Response.json({ error: 'Akses ditolak.' }, { status: 401, headers });
    if (!validateOrigin(request) || !validateCsrf(request)) {
      return Response.json({ error: 'Permintaan ditolak (CSRF).' }, { status: 403, headers });
    }
    const ip = getClientIp(request);
    const limit = await rateLimit(`ordering:update:${ip}`, 30, 60_000);
    if (!limit.allowed) return rateLimitResponse(limit);

    const parsed = orderingSettingsUpdateSchema.safeParse(await readJsonBody(request, 4096));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || 'Pengaturan Pemesanan tidak valid.' }, { status: 400, headers });
    }
    return Response.json(await updateOrderingSettings(parsed.data, ip), { headers });
  } catch (error) {
    return apiErrorResponse(error, 'Gagal menyimpan pengaturan Pemesanan.');
  }
}
