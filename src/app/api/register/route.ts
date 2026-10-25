import { NextResponse } from 'next/server';
import { createParticipant } from '@/lib/db';
import { CategoryType, BatchType, CATEGORY_OPTIONS, BATCH_OPTIONS } from '@/lib/types';
import { sendInvitationEmail } from '@/lib/mailer';
import { registrationSchema } from '@/lib/validation';
import { rateLimit, getClientIp, tooManyResponse } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`register:${ip}`, 5, 60_000);
  if (!limit.allowed) return tooManyResponse(limit.retryAfter);

  try {
    const body = await request.json();

    // Honeypot: real users never see or fill this field.
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    }

    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message || 'Data tidak valid.';
      return NextResponse.json({ error: `Data tidak valid: ${first}` }, { status: 400 });
    }
    const { nimNip, name, role, category, batch, prodi, email, phone } = parsed.data;

    if (!CATEGORY_OPTIONS.includes(category as CategoryType)) {
      return NextResponse.json({ error: 'Kategori civitas tidak valid!' }, { status: 400 });
    }

    // Optional bot check (active only when TURNSTILE_SECRET_KEY is configured).
    if (process.env.TURNSTILE_SECRET_KEY) {
      const token = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
      if (!(await verifyTurnstile(token, ip))) {
        return NextResponse.json(
          { error: 'Verifikasi anti-bot gagal. Muat ulang halaman lalu coba lagi.' },
          { status: 400 }
        );
      }
    }

    // Cap submissions per recipient address to stop email-bombing via one inbox.
    const normalizedEmail = email.trim().toLowerCase();
    const emailLimit = rateLimit(`register:email:${normalizedEmail}`, 2, 60 * 60_000);
    if (!emailLimit.allowed) return tooManyResponse(emailLimit.retryAfter);

    const resolvedBatch: BatchType =
      category === 'Mahasiswa Fasilkom' && BATCH_OPTIONS.includes(batch as BatchType) ? (batch as BatchType) : '-';

    const result = await createParticipant({
      nimNip,
      name,
      role,
      category: category as CategoryType,
      batch: resolvedBatch,
      prodi: prodi || '-',
      email: normalizedEmail,
      phone: phone || '-',
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // ponytail: email best-effort, never blocks ticket issuance.
    let emailSent = false;
    if (result.participant) {
      try {
        const mail = await sendInvitationEmail({
          to: result.participant.email,
          name: result.participant.name,
          qrToken: result.participant.qrToken,
          category: result.participant.category,
          batch: result.participant.batch,
        });
        emailSent = mail.sent;
      } catch (err) {
        console.error('Invitation email failed:', err);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      participant: result.participant,
      ticketUrl: `/ticket/${result.participant?.qrToken}`,
    });
  } catch (err) {
    console.error('Registration API error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat memproses registrasi.' },
      { status: 500 }
    );
  }
}
