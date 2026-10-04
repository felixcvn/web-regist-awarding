import { z } from 'zod';

// CSV formula-injection guard: values starting with = + - @ can execute in spreadsheets.
export function csvSafe(value: unknown): string {
  const s = String(value ?? '');
  const escaped = s.replace(/"/g, '""');
  return /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
}

export const registrationSchema = z.object({
  nimNip: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9./-]+$/, 'NIM/NIP mengandung karakter tidak valid'),
  name: z.string().trim().min(1).max(120),
  role: z.enum(['Mahasiswa', 'Dosen', 'Tenaga Pendidik', 'Tamu Undangan']),
  category: z.string().trim().min(1).max(40),
  batch: z.string().trim().max(4).optional().default('-'),
  prodi: z.string().trim().max(80).optional().default('-'),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(20).optional().default('-'),
});

export type RegistrationPayload = z.infer<typeof registrationSchema>;

export const qrTokenSchema = z.string().trim().max(64);
