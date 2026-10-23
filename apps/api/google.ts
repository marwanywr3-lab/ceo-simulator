import { createRemoteJWKSet, jwtVerify } from "jose";
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export async function verifyGoogle(
  credential: string,
  clientId: string,
  nonce: string,
) {
  const { payload } = await jwtVerify(credential, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    algorithms: ["RS256"],
    maxTokenAge: "10m",
  });
  if (
    payload.nonce !== nonce ||
    !payload.sub ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  )
    throw new Error("Invalid Google identity");
  return { subject: payload.sub, email: payload.email.toLowerCase() };
}
