import { NextResponse } from 'next/server';
import { createParticipant } from '@/lib/db';
import { RoleType, CategoryType, BatchType, CATEGORY_OPTIONS, BATCH_OPTIONS } from '@/lib/types';
import { sendInvitationEmail } from '@/lib/mailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nimNip, name, role, category, batch, prodi, email, phone } = body;

    // Validation
    if (!nimNip || !name || !role || !email || !category) {
      return NextResponse.json(
        { error: 'Mohon lengkapi data wajib (NIM/NIP, Nama, Peran, Kategori, Email)!' },
        { status: 400 }
      );
    }

    const validRoles: RoleType[] = ['Mahasiswa', 'Dosen', 'Tenaga Pendidik', 'Tamu Undangan'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Peran civitas tidak valid!' }, { status: 400 });
    }

    if (!CATEGORY_OPTIONS.includes(category)) {
      return NextResponse.json({ error: 'Kategori civitas tidak valid!' }, { status: 400 });
    }

    const resolvedBatch: BatchType =
      category === 'Mahasiswa Fasilkom' && BATCH_OPTIONS.includes(batch) ? batch : '-';

    const result = await createParticipant({
      nimNip,
      name,
      role,
      category: category as CategoryType,
      batch: resolvedBatch,
      prodi: prodi || '-',
      email,
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
  } catch (err: any) {
    console.error('Registration API error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat memproses registrasi.' },
      { status: 500 }
    );
  }
}
