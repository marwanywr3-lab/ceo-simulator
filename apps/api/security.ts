import { timingSafeEqual } from "node:crypto";
export class PayloadTooLarge extends Error {}

/** Enforce the cap while reading, including chunked requests with no Content-Length. */
export async function readLimitedBody(
  stream: ReadableStream<Uint8Array>,
  maxBytes = 16384,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLarge("Body too large");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function equalSecret(
  provided: string,
  expected: string,
): Promise<boolean> {
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode.encode(provided)),
    crypto.subtle.digest("SHA-256", encode.encode(expected)),
  ]);
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}
