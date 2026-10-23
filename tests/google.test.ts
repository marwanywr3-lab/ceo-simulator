import { beforeAll, describe, it, expect } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { verifyGoogleWithKeys } from "../apps/api/google";
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
beforeAll(async () => {
  pair = await generateKeyPair("RS256");
});
async function credential(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    email: "Example@EXAMPLE.test",
    email_verified: true,
    nonce: "one-time-nonce",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("google-subject")
    .setIssuer("https://accounts.google.com")
    .setAudience("game-client.apps.googleusercontent.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pair.privateKey);
}
describe("Google identity cryptographic validation", () => {
  it("accepts a signed verified identity with the correct audience and nonce", async () => {
    expect(
      await verifyGoogleWithKeys(
        await credential(),
        "game-client.apps.googleusercontent.com",
        "one-time-nonce",
        pair.publicKey,
      ),
    ).toEqual({ subject: "google-subject", email: "example@example.test" });
  });
  it("rejects an identity issued for a different app", async () => {
    await expect(
      verifyGoogleWithKeys(
        await credential(),
        "another-app",
        "one-time-nonce",
        pair.publicKey,
      ),
    ).rejects.toThrow();
  });
  it("rejects a swapped challenge", async () => {
    await expect(
      verifyGoogleWithKeys(
        await credential(),
        "game-client.apps.googleusercontent.com",
        "other-nonce",
        pair.publicKey,
      ),
    ).rejects.toThrow();
  });
  it("rejects an unverified Google email", async () => {
    await expect(
      verifyGoogleWithKeys(
        await credential({ email_verified: false }),
        "game-client.apps.googleusercontent.com",
        "one-time-nonce",
        pair.publicKey,
      ),
    ).rejects.toThrow();
  });
  it("rejects a token signed by another key", async () => {
    const other = await generateKeyPair("RS256");
    await expect(
      verifyGoogleWithKeys(
        await credential(),
        "game-client.apps.googleusercontent.com",
        "one-time-nonce",
        other.publicKey,
      ),
    ).rejects.toThrow();
  });
});
