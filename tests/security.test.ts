import { describe, it, expect } from "vitest";
import { PayloadTooLarge, readLimitedBody } from "../apps/api/security";
describe("bounded request streaming", () => {
  it("decodes multibyte JSON across network chunks", async () => {
    const b = new TextEncoder().encode('{"text":"الرياض"}');
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(b.slice(0, 12));
        c.enqueue(b.slice(12));
        c.close();
      },
    });
    expect(await readLimitedBody(stream)).toBe('{"text":"الرياض"}');
  });
  it("cancels an oversized stream without buffering remaining input", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new Uint8Array(1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(readLimitedBody(stream, 1500)).rejects.toBeInstanceOf(
      PayloadTooLarge,
    );
    expect(cancelled).toBe(true);
  });
});
