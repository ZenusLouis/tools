const COOKIE_NAME = "gcs_session";
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

export type AuthPayload = {
  userId: string;
  workspaceId: string;
  email: string;
  exp: number;
};

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return atob(padded);
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return secret;
}

export function authCookieName(): string {
  return COOKIE_NAME;
}

export async function signAuthToken(payload: Omit<AuthPayload, "exp">, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const body: AuthPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;
  const signature = await crypto.subtle.sign("HMAC", await getKey(getSecret()), new TextEncoder().encode(data));
  return `${data}.${base64UrlEncode(signature)}`;
}

export async function verifyAuthToken(token: string | undefined): Promise<AuthPayload | null> {
  if (!token) return null;
  const [encodedHeader, encodedBody, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedBody || !encodedSignature) return null;

  const data = `${encodedHeader}.${encodedBody}`;
  const signatureBytes = Uint8Array.from(base64UrlDecode(encodedSignature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    "HMAC",
    await getKey(getSecret()),
    signatureBytes,
    new TextEncoder().encode(data)
  );
  if (!valid) return null;

  const payload = JSON.parse(base64UrlDecode(encodedBody)) as AuthPayload;
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
