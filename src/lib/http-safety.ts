/** Count streamed UTF-8 bytes before parsing, including chunked bodies. */
export async function readJsonBody(request: Request, maxBytes = 1_048_576, empty = false): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new BodyError(413);
  const reader = request.body?.getReader();
  if (!reader) { if (empty) return {}; throw new BodyError(400); }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new BodyError(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (empty && !text.trim()) return {};
    return JSON.parse(text);
  } catch (error) { if (error instanceof BodyError) throw error; throw new BodyError(400); }
  finally { reader.releaseLock(); }
}
export class BodyError extends Error {
  constructor(public status: number) { super(status === 413 ? "Request body too large" : "Malformed JSON body"); }
}
export function bodyError(error: unknown) {
  return Response.json({ error: error instanceof BodyError ? error.message : "Malformed JSON body" }, { status: error instanceof BodyError ? error.status : 400 });
}
