import { NextResponse } from 'next/server';
import { createParticipant } from '@/lib/db';
import { RoleType } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nimNip, name, role, prodi, email, phone } = body;

    // Validation
    if (!nimNip || !name || !role || !email) {
      return NextResponse.json(
        { error: 'Mohon lengkapi data wajib (NIM/NIP, Nama, Peran, Email)!' },
        { status: 400 }
      );
    }

    const validRoles: RoleType[] = ['Mahasiswa', 'Dosen', 'Tenaga Pendidik', 'Tamu Undangan'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Peran civitas tidak valid!' }, { status: 400 });
    }

    const result = await createParticipant({
      nimNip,
      name,
      role,
      prodi: prodi || '-',
      email,
      phone: phone || '-',
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
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
