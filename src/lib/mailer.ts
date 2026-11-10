import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const EVENT = {
  title: 'Fasilkom Awarding Night 2026',
  tagline: 'Secret Garden: Dreams to History',
  date: 'Selasa, 1 Desember 2026 • 17:30 WIB',
  venue: 'Gedung Soetardjo Universitas Jember',
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

// Resolve the public base URL for ticket links, in order of reliability:
// 1. NEXT_PUBLIC_APP_URL (explicit, required in production)
// 2. VERCEL_URL (auto-injected on Vercel, no scheme)
// 3. localhost (dev fallback)
function resolveBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

  if (process.env.NODE_ENV === 'production') {
    console.error('[Mailer] NEXT_PUBLIC_APP_URL is not set — email links may point to localhost.');
  }
  return 'http://localhost:3000';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface InvitationContent {
  name: string;
  category: string;
  batch: string;
  ticketUrl: string;
}

function buildHtml({ name, category, batch, ticketUrl }: InvitationContent): string {
  const batchLabel = batch !== '-' ? batch : '';
  // Escape both visible text and link attributes in the HTML alternative.
  const safeName = escapeHtml(name);
  const categoryLine = escapeHtml(category);
  const batchLine = batchLabel ? ` • Angkatan: ${escapeHtml(batchLabel)}` : '';
  const safeTicketUrl = escapeHtml(ticketUrl);

  return `<!DOCTYPE html>
  <html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:Arial,Helvetica,sans-serif;background:#061510;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;margin:0 auto;background:#0E2A20;border:1px solid #315044;border-radius:16px;color:#EDE8DF;">
        <tr>
          <td style="padding:28px 24px 12px;">
            <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#FFB5E8;">
              Konfirmasi Pendaftaran
            </p>
            <h1 style="margin:0 0 8px;font-size:22px;line-height:1.4;color:#FAF7F0;font-family:Georgia,'Times New Roman',serif;">
              ${EVENT.title}
            </h1>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#EDE8DF;">
              ${EVENT.tagline}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 24px;">
            <p style="margin:12px 0;font-size:14px;line-height:1.7;color:#EDE8DF;">
              Halo, <b>${safeName}</b>.
            </p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#EDE8DF;">
              Pendaftaran Anda berhasil. Anda menerima email ini karena telah mendaftar melalui website Fasilkom Awarding Night 2026.
            </p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#EDE8DF;">
              Silakan buka halaman tiket untuk melihat QR dan mengunduh tiket digital Anda.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
              <tr>
                <td align="center" style="background:#FFB5E8;border-radius:10px;">
                  <a href="${safeTicketUrl}" style="display:inline-block;background:#FFB5E8;color:#061811;font-weight:bold;font-size:14px;line-height:1.5;text-decoration:none;padding:14px 24px;border:1px solid #FFB5E8;border-radius:10px;">
                    Lihat &amp; Unduh Tiket
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;line-height:1.7;color:#EDE8DF;">
              Jika tombol tidak dapat dibuka, salin tautan berikut ke browser:
            </p>
            <p style="margin:0 0 18px;font-size:12px;line-height:1.7;word-break:break-all;">
              <a href="${safeTicketUrl}" style="color:#FFB5E8;text-decoration:underline;word-break:break-all;">${safeTicketUrl}</a>
            </p>
            <p style="margin:0;font-size:13px;line-height:1.7;color:#EDE8DF;">
              Unduh dan simpan tiket di perangkat Anda, lalu tunjukkan QR kepada panitia saat check-in. Jangan bagikan tautan tiket ini kepada orang lain.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px;border-top:1px solid #315044;">
            <p style="margin:0 0 6px;font-size:12px;line-height:1.7;color:#EDE8DF;">
              ${EVENT.date}<br />${EVENT.venue}
            </p>
            <p style="margin:0;font-size:12px;line-height:1.7;color:#EDE8DF;">
              ${categoryLine}${batchLine}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
  </body>
  </html>`;
}

function buildText({ name, category, batch, ticketUrl }: InvitationContent): string {
  const batchLine = batch && batch !== '-' ? ` • Angkatan: ${batch}` : '';

  return [
    `Konfirmasi Pendaftaran — ${EVENT.title}`,
    EVENT.tagline,
    '',
    `Halo, ${name}.`,
    '',
    'Pendaftaran Anda berhasil. Anda menerima email ini karena telah mendaftar melalui website Fasilkom Awarding Night 2026.',
    '',
    'Silakan buka halaman tiket untuk melihat QR dan mengunduh tiket digital Anda:',
    ticketUrl,
    '',
    'Unduh dan simpan tiket di perangkat Anda, lalu tunjukkan QR kepada panitia saat check-in.',
    'Jangan bagikan tautan tiket ini kepada orang lain.',
    '',
    EVENT.date,
    EVENT.venue,
    `${category}${batchLine}`,
  ].join('\n');
}

export async function sendInvitationEmail({ to, name, qrToken, category, batch }: { to: string; name: string; qrToken: string; category: string; batch: string }): Promise<{ sent: boolean }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[Mailer] GMAIL_USER / GMAIL_APP_PASSWORD belum diset, email dilewati.');
    return { sent: false };
  }

  const baseUrl = resolveBaseUrl();
  const ticketUrl = `${baseUrl}/ticket/${encodeURIComponent(qrToken)}`;
  const content = { name, category, batch, ticketUrl };

  // Link-only confirmation: QR images stay on the ticket page. Legacy
  // QR_EMAIL_MODE values are intentionally ignored; no attachments are sent.
  await transport.sendMail({
    from: `"Fasilkom Awarding Night 2026" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Konfirmasi Pendaftaran — ${EVENT.title}`,
    text: buildText(content),
    html: buildHtml(content),
  });

  return { sent: true };
}
