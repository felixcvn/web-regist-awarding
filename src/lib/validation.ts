import { z } from 'zod';
import { isTallyFormUrl } from './orderingSettings';

// CSV formula-injection guard: values starting with = + - @ can execute in spreadsheets.
export function csvSafe(value: unknown): string {
  const s = String(value ?? '');
  const escaped = s.replace(/"/g, '""');
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
}

export const studentNimSchema = z.string().trim().regex(/^2[3-6]\d{6}(?:1[01]|2[01]|3[01])\d{2}$/, 'NIM harus 12 digit dengan angkatan dan kode prodi yang valid');

export const registrationSchema = z.object({
  nimNip: studentNimSchema,
  name: z.string().trim().min(1).max(120),
  role: z.enum(['Mahasiswa', 'Dosen', 'Tenaga Pendidik', 'Tamu Undangan']),
  category: z.string().trim().min(1).max(40),
  batch: z.string().trim().max(4).optional().default('-'),
  prodi: z.string().trim().max(80).optional().default('-'),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(20).optional().default('-'),
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

export type RegistrationPayload = z.infer<typeof registrationSchema>;

export const qrTokenSchema = z.string().trim().min(1).max(64);
export const checkinSchema = z.object({ qrToken: qrTokenSchema });
export const loginSchema = z.object({ pin: z.string().trim().min(1).max(128) });
export const studentIdentitySchema = z.object({ nim: studentNimSchema, name: z.string().trim().min(1).max(120) });
export const studentImportCommitSchema = z.object({
  batchId: z.string().regex(/^STU-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
}).strict();

export const orderingSettingsUpdateSchema = z.object({
  visible: z.boolean().optional(),
  tallyUrl: z.string().trim().max(2048).refine(
    (value) => value === '' || isTallyFormUrl(value),
    'Gunakan link form Tally dengan format https://tally.so/r/… atau kosongkan link.',
  ).optional(),
}).strict().refine((value) => value.visible !== undefined || value.tallyUrl !== undefined, {
  message: 'Pilih pengaturan Pemesanan yang ingin diubah.',
});
