import { NextResponse } from 'next/server';
import { createParticipant } from '@/lib/db';
import { CategoryType, BatchType, CATEGORY_OPTIONS, BATCH_OPTIONS } from '@/lib/types';
import { sendInvitationEmail } from '@/lib/mailer';
import { registrationSchema } from '@/lib/validation';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { readJsonBody } from '@/lib/requestBody';
import { apiErrorResponse } from '@/lib/apiErrors';
import { toPublicTicket } from '@/lib/publicTicket';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = await rateLimit(`register:${ip}`, 5, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const body = await readJsonBody(request);
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message || 'Data tidak valid.';
      return NextResponse.json({ error: `Data tidak valid: ${first}` }, { status: 400 });
    }
    const { nimNip, name, role, category, batch, prodi, email, phone } = parsed.data;

    // Honeypot: real users never see or fill this field.
    if (parsed.data.website?.trim()) {
      return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
    }

    // The public registration form only registers students. Do not let a direct
    // API caller bypass the student master check by submitting another role.
    if (role !== 'Mahasiswa') {
      return NextResponse.json({ error: 'Registrasi publik hanya tersedia untuk mahasiswa.' }, { status: 403 });
    }

    if (!CATEGORY_OPTIONS.includes(category as CategoryType)) {
      return NextResponse.json({ error: 'Kategori civitas tidak valid!' }, { status: 400 });
    }

    // Optional bot check (active only when TURNSTILE_SECRET_KEY is configured).
    if (process.env.TURNSTILE_SECRET_KEY) {
      const token = parsed.data.turnstileToken || '';
      if (!(await verifyTurnstile(token, ip))) {
        return NextResponse.json(
          { error: 'Verifikasi anti-bot gagal. Muat ulang halaman lalu coba lagi.' },
          { status: 400 }
        );
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

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
      return NextResponse.json({ error: result.error }, { status: result.status || 409 });
    }
    const participant = result.participant;
    if (!participant) throw new Error('Participant creation returned no record.');

    // Only successful registrations consume the recipient's email-attempt quota.
    // Quota exhaustion or mail failure still returns the already-issued ticket.
    let emailSent = false;
    try {
      const emailLimit = await rateLimit(`register:email:${normalizedEmail}`, 2, 60 * 60_000);
      if (emailLimit.allowed) {
        const mail = await sendInvitationEmail({
          to: participant.email,
          name: participant.name,
          qrToken: participant.qrToken,
          category: participant.category,
          batch: participant.batch,
        });
        emailSent = mail.sent;
      }
    } catch (err) {
      console.error('Invitation email failed:', err);
    }

    return NextResponse.json({
      success: true,
      emailSent,
      participant: toPublicTicket(participant),
      ticketUrl: `/ticket/${participant.qrToken}`,
    });
  } catch (err) {
    return apiErrorResponse(err, 'Terjadi kesalahan sistem saat memproses registrasi.');
  }
}
