import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { ApiError } from './apiErrors';
import { MAX_STUDENT_FILE_BYTES, MAX_STUDENT_IMPORT_ROWS, type StudentImportFiles } from './studentImportFiles';
import { validateXlsxArchive } from './xlsxArchive';

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('id-ID');
}

export function normalizeNim(nim: string): string {
  return nim.trim().toLowerCase();
}

export interface StudentImportResult {
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateNims: number;
  emptyNames: number;
  invalidNims: number;
  errors: string[];
}

export interface ImportedStudent {
  nim: string;
  name: string;
  normalizedName: string;
  prodi: string;
  batchYear: string;
}

interface ParsedStudentImport {
  students: ImportedStudent[];
  result: StudentImportResult;
}

const STUDENT_PRODI_CODES: Record<string, string> = {
  '10': 'Sistem Informasi',
  '11': 'Sistem Informasi',
  '20': 'Teknologi Informasi',
  '21': 'Teknologi Informasi',
  '30': 'Informatika',
  '31': 'Informatika',
};

const MAX_IMPORT_ERRORS = 100;

export async function parseStudentImportFiles(files: StudentImportFiles): Promise<ParsedStudentImport> {
  const students: ImportedStudent[] = [];
  const seenNims = new Set<string>();
  const errors: string[] = [];
  let totalRows = 0;
  let duplicateNims = 0;
  let emptyNames = 0;
  let invalidNims = 0;
  let errorsTruncated = false;

  const addError = (message: string) => {
    if (errors.length < MAX_IMPORT_ERRORS - 1) errors.push(message);
    else errorsTruncated = true;
  };

  const processFile = async (
    file: File | undefined,
    label: string,
    expectedProdi: string
  ): Promise<void> => {
    if (!file) {
      addError(`File ${label} belum diunggah.`);
      return;
    }
    if (file.size === 0 || file.size > MAX_STUDENT_FILE_BYTES) {
      addError(`File ${label}: ukuran file harus antara 1 byte dan 5 MB.`);
      return;
    }

    let rows: unknown[][];
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await validateXlsxArchive(buffer);
      const workbook = XLSX.read(buffer, { type: 'buffer', sheets: 0, sheetRows: MAX_STUDENT_IMPORT_ROWS + 1 });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        addError(`File ${label} tidak memiliki worksheet.`);
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
      if (range.e.r > MAX_STUDENT_IMPORT_ROWS || range.e.c > 127) {
        addError(`File ${label}: maksimal ${MAX_STUDENT_IMPORT_ROWS} baris data dan 128 kolom.`);
        return;
      }
      rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
    } catch (error) {
      addError(`File ${label}: ${error instanceof ApiError ? error.message : 'tidak dapat dibaca sebagai Excel .xlsx.'}`);
      return;
    }

    const headerIndex = rows.findIndex((row) =>
      row.some((cell) => String(cell).trim().toLocaleUpperCase('id-ID') === 'NIM')
    );
    if (headerIndex < 0) {
      addError(`File ${label}: header kolom NIM tidak ditemukan.`);
      return;
    }

    const header = rows[headerIndex].map((cell) => String(cell).trim().toLocaleUpperCase('id-ID'));
    const nimColumn = header.indexOf('NIM');
    const nameColumn = header.findIndex((value) => value === 'NAMA' || value === 'NAMA LENGKAP');
    if (nameColumn < 0) {
      addError(`File ${label}: kolom NAMA atau NAMA LENGKAP tidak ditemukan.`);
      return;
    }

    const validBeforeFile = students.length;
    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row || row.every((cell) => String(cell).trim() === '')) continue;

      totalRows++;
      if (totalRows > MAX_STUDENT_IMPORT_ROWS) {
        throw new ApiError(`Maksimal total impor adalah ${MAX_STUDENT_IMPORT_ROWS} baris mahasiswa.`, 400);
      }
      const rowLabel = `Baris ${rowIndex + 1} (${label})`;
      const nim = String(row[nimColumn] ?? '').trim();
      const name = String(row[nameColumn] ?? '').trim().replace(/\s+/g, ' ');

      if (!name) {
        emptyNames++;
        addError(`${rowLabel}: nama kosong.`);
        continue;
      }
      if (name.length > 120 || normalizeName(name).length > 120) {
        addError(`${rowLabel}: nama maksimal 120 karakter.`);
        continue;
      }

      if (!/^\d{12}$/.test(nim)) {
        invalidNims++;
        addError(`${rowLabel}: NIM wajib terdiri dari tepat 12 digit.`);
        continue;
      }

      const yearDigit = nim.slice(0, 2);
      if (!['23', '24', '25', '26'].includes(yearDigit)) {
        invalidNims++;
        addError(`${rowLabel}: NIM tidak memiliki angkatan valid (2023–2026).`);
        continue;
      }

      const prodi = STUDENT_PRODI_CODES[nim.slice(8, 10)];
      if (!prodi) {
        invalidNims++;
        addError(`${rowLabel}: kode program studi pada NIM tidak dikenali.`);
        continue;
      }
      if (prodi !== expectedProdi) {
        invalidNims++;
        addError(`${rowLabel}: NIM menunjukkan prodi ${prodi}, bukan ${expectedProdi}.`);
        continue;
      }

      const normalizedNim = normalizeNim(nim);
      if (seenNims.has(normalizedNim)) {
        duplicateNims++;
        addError(`${rowLabel}: NIM duplikat ditemukan pada file yang diunggah.`);
        continue;
      }

      seenNims.add(normalizedNim);
      students.push({ nim: normalizedNim, name, normalizedName: normalizeName(name), prodi, batchYear: `20${yearDigit}` });
    }
    if (students.length === validBeforeFile) addError(`File ${label} tidak memiliki baris mahasiswa valid.`);
  };

  await processFile(files.sistemInformasi, 'Sistem Informasi', 'Sistem Informasi');
  await processFile(files.informatika, 'Informatika', 'Informatika');
  await processFile(files.teknologiInformasi, 'Teknologi Informasi', 'Teknologi Informasi');
  if (errorsTruncated) errors.push('Kesalahan lainnya tidak ditampilkan. Periksa semua baris pada file yang diunggah.');

  const result: StudentImportResult = {
    batchId: `STU-${crypto.randomUUID()}`,
    totalRows,
    validRows: students.length,
    invalidRows: totalRows - students.length,
    duplicateNims,
    emptyNames,
    invalidNims,
    errors,
  };
  return { students, result };
}
