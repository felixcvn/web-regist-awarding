import { getOrderingSettings } from '@/lib/db';
import { apiErrorResponse } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getOrderingSettings();
    // This endpoint contains public navigation configuration only. Do not put
    // every visitor on the same IP quota (e.g. campus Wi-Fi or unknown ingress).
    return Response.json({ visible: settings.visible, tallyUrl: settings.visible ? settings.tallyUrl : '' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error, 'Pengaturan Pemesanan belum dapat dimuat.');
  }
}
