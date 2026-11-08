import { fromBuffer, type Entry } from 'yauzl';
import type { Readable } from 'node:stream';
import { ApiError } from './apiErrors';

const MAX_ENTRIES = 512;
const MAX_EXPANDED_BYTES = 40 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';

// Validate every ZIP entry, including actual inflated byte counts, before SheetJS
// loads the workbook. Renaming a CSV or lying about ZIP sizes cannot bypass this.
export async function validateXlsxArchive(buffer: Buffer): Promise<void> {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new ApiError('File harus berupa workbook Excel .xlsx yang valid.', 400);
  }

  await new Promise<void>((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) {
        reject(new ApiError('Arsip Excel tidak valid.', 400));
        return;
      }
      const names = new Set<string>();
      let declaredBytes = 0;
      let expandedBytes = 0;
      let contentTypes = '';
      let currentStream: Readable | undefined;
      let settled = false;
      const timer = setTimeout(() => fail('Waktu pemeriksaan Excel melebihi batas.'), 10_000);

      function fail(message: string) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        currentStream?.destroy();
        zip.close();
        reject(new ApiError(message, 400));
      }

      zip.on('error', () => fail('Arsip Excel rusak atau ukuran isinya tidak valid.'));
      zip.on('end', () => {
        if (settled) return;
        if (!names.has('xl/workbook.xml') || !names.has('_rels/.rels') || !contentTypes.includes(XLSX_CONTENT_TYPE)) {
          fail('File tidak memiliki struktur workbook .xlsx yang valid.');
          return;
        }
        settled = true;
        clearTimeout(timer);
        zip.close();
        resolve();
      });
      zip.on('entry', (entry: Entry) => {
        if (settled) return;
        const name = entry.fileName;
        declaredBytes += entry.uncompressedSize;
        if (names.has(name) || names.size >= MAX_ENTRIES || name.split('/').includes('..') || name.includes('\0')) {
          fail('Struktur arsip Excel tidak valid atau terlalu kompleks.');
          return;
        }
        names.add(name);
        if ((entry.generalPurposeBitFlag & 1) !== 0 || ![0, 8].includes(entry.compressionMethod)) {
          fail('Excel terenkripsi atau metode kompresinya tidak didukung.');
          return;
        }
        if (entry.uncompressedSize > MAX_ENTRY_BYTES || declaredBytes > MAX_EXPANDED_BYTES) {
          fail('Isi Excel setelah dekompresi terlalu besar.');
          return;
        }
        if (name.endsWith('/')) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail('Isi arsip Excel tidak dapat dibaca.');
            return;
          }
          if (settled) { stream.destroy(); return; }
          currentStream = stream;
          let entryBytes = 0;
          stream.on('data', (chunk: Buffer) => {
            entryBytes += chunk.length;
            expandedBytes += chunk.length;
            if (entryBytes > MAX_ENTRY_BYTES || expandedBytes > MAX_EXPANDED_BYTES) {
              fail('Isi Excel setelah dekompresi terlalu besar.');
              return;
            }
            if (name === '[Content_Types].xml') {
              if (entryBytes > 64 * 1024) { fail('Metadata Excel terlalu besar.'); return; }
              contentTypes += chunk.toString('utf8');
            }
          });
          stream.on('error', () => fail('Isi arsip Excel rusak atau ukuran isinya tidak valid.'));
          stream.on('end', () => {
            currentStream = undefined;
            if (!settled) zip.readEntry();
          });
        });
      });
      if (zip.entryCount > MAX_ENTRIES) fail('Struktur arsip Excel terlalu kompleks.');
      else zip.readEntry();
    });
  });
}
