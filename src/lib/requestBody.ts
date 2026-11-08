import { ApiError } from './apiErrors';

async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new ApiError('Ukuran permintaan terlalu besar.', 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ApiError('Isi permintaan wajib disertakan.', 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ApiError('Ukuran permintaan terlalu besar.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJsonBody(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new ApiError('Format permintaan harus JSON.', 415);
  }
  const body = await readBoundedBody(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new ApiError('Isi JSON tidak valid.', 400);
  }
}

export async function readImportForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data(?:\s*;|$)/i.test(contentType)) {
    throw new ApiError('Format unggahan tidak valid.', 415);
  }
  // Three files of 5 MiB each, plus a bounded multipart envelope.
  const body = await readBoundedBody(request, 15 * 1024 * 1024 + 64 * 1024);
  try {
    return await new Response(body, { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    throw new ApiError('Isi unggahan tidak valid.', 400);
  }
}
