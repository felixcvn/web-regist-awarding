import { ApiError } from './apiErrors';

export const STUDENT_FILE_FIELDS = ['sistemInformasi', 'informatika', 'teknologiInformasi'] as const;
export const MAX_STUDENT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_STUDENT_IMPORT_ROWS = 10_000;
export type StudentImportFiles = Record<typeof STUDENT_FILE_FIELDS[number], File>;

export function studentFilesFromForm(form: FormData): StudentImportFiles {
  for (const field of form.keys()) {
    if (!STUDENT_FILE_FIELDS.some((expected) => expected === field)) {
      throw new ApiError('Field unggahan tidak dikenali.', 400);
    }
  }
  const files = {} as StudentImportFiles;
  for (const field of STUDENT_FILE_FIELDS) {
    const entries = form.getAll(field);
    const file = entries[0];
    if (entries.length !== 1 || !(file instanceof File) || file.size === 0) {
      throw new ApiError('Harap unggah tepat satu file Excel berisi data untuk setiap prodi.', 400);
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      throw new ApiError('Format file harus .xlsx.', 400);
    }
    if (file.size > MAX_STUDENT_FILE_BYTES) {
      throw new ApiError('Maksimal ukuran setiap file adalah 5 MB.', 400);
    }
    files[field] = file;
  }
  return files;
}
