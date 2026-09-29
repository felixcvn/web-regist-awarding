import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import QRCode from 'qrcode';

const EVENT = {
  title: 'Fasilkom Awarding Night 2026',
  tagline: 'Secret Garden: Dreams to History',
  date: 'Selasa, 1 Desember 2026 • 17:30 WIB',
  venue: 'Auditorium Gedung Biru, Fasilkom UNEJ',
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

function buildHtml({ name, category, batch, qrToken, imgSrc, ticketUrl }: { name: string; category: string; batch: string; qrToken: string; imgSrc: string; ticketUrl: string }): string {
  const batchLabel = batch !== '-' ? batch : '';
  const categoryLine = category;
  const batchLine = batchLabel ? ` • Angkatan: ${batchLabel}` : '';

  return `
  <table width="100%" style="font-family:Arial,Helvetica,sans-serif;background:#061510;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" style="margin:0 auto;background:#0E2A20;border:1px solid rgba(255,181,232,0.3);border-radius:20px;overflow:hidden;color:#EDE8DF;">
        <tr>
          <td style="padding:28px 24px 12px;text-align:center;">
            <table width="100%" style="margin:0 auto;">
              <tr>
                <td style="text-align:center;">
                  <span style="display:inline-block;padding:4px 14px;border-radius:999px;background:#184535;color:#FFB5E8;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;border:1px solid rgba(255,181,232,0.5);">
                    Official VIP Pass
                  </span>
                </td>
              </tr>
              <tr><td style="padding-top:14px;">
                <h1 style="margin:4px 0;font-size:22px;color:#FAF7F0;font-family:Georgia,'Times New Roman',serif;letter-spacing:1px;">
                  FASILKOM AWARDING NIGHT 2026
                </h1>
                <p style="margin:0;font-size:12px;color:#FFB5E8;letter-spacing:3px;text-transform:uppercase;">
                  ${EVENT.tagline}
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;text-align:center;">
            <p style="margin:16px 0 4px;font-size:14px;color:#EDE8DF;">
              Halo, <b style="color:#FFB5E8;">${name}</b>
            </p>
            <p style="margin:0 0 22px;font-size:13px;color:rgba(237,232,223,0.8);">
              Registrasi Anda berhasil. Berikut QR undangan resmi Anda.
            </p>
            <table width="100%" style="margin:0 auto;border-radius:18px;overflow:hidden;">
              <tr>
                <td style="padding:22px;background:#ffffff;border:3px solid #FFB5E8;text-align:center;">
                  <img src="${imgSrc}" alt="QR Undangan" width="260" height="260" style="display:block;margin:0 auto;" />
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 24px;font-size:12px;color:#FFB5E8;font-family:monospace;letter-spacing:1px;">
              ${qrToken}
            </p>
            <table width="100%" style="margin:0 auto;">
              <tr>
                <td style="text-align:center;">
                  <a href="${ticketUrl}" style="display:inline-block;background:#FFB5E8;color:#061811;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:14px;">
                    Lihat & Unduh Tiket Digital
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;border-top:1px solid rgba(255,181,232,0.2);text-align:center;">
            <table width="100%" style="margin:0 auto;">
              <tr><td style="padding:0 0 4px;">
                <p style="margin:0;font-size:12px;color:#EDE8DF;">
                  📅 ${EVENT.date}
                </p>
              </td></tr>
              <tr><td style="padding:0;">
                <p style="margin:0;font-size:12px;color:#EDE8DF;">
                  📍 ${EVENT.venue}
                </p>
              </td></tr>
              <tr><td style="padding:16px 0 0;">
                <p style="margin:0;font-size:11px;color:rgba(237,232,223,0.4);">
                  Tunjukkan QR Code ini kepada panitia di pintu masuk.
                  ${categoryLine}${batchLine ? `<br/>${batchLine}` : ''}
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}

async function generateQrBuffer(qrToken: string): Promise<Buffer> {
  return QRCode.toBuffer(qrToken, { margin: 5, width: 600, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } });
}

export async function sendInvitationEmail({ to, name, qrToken, category, batch }: { to: string; name: string; qrToken: string; category: string; batch: string }): Promise<{ sent: boolean }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[Mailer] GMAIL_USER / GMAIL_APP_PASSWORD belum diset, email dilewati.');
    return { sent: false };
  }

  const mode = (process.env.QR_EMAIL_MODE as 'cid' | 'url') || 'cid';
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const ticketUrl = `${baseUrl}/ticket/${qrToken}`;
  const imgSrc = mode === 'cid' ? 'cid:qr-invitation' : `${baseUrl}/api/qr/${qrToken}`;

  const qrBuffer = await generateQrBuffer(qrToken);

  await transport.sendMail({
    from: `"Fasilkom Awarding Night 2026" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Tiket Undangan — Fasilkom Awarding Night 2026',
    html: buildHtml({ name, category, batch, qrToken, imgSrc, ticketUrl }),
    attachments: mode === 'cid' ? [{ filename: 'qr-invitation.png', content: qrBuffer, cid: 'qr-invitation' }] : [],
  });

  return { sent: true };
}