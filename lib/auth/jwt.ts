import type { SessionClaims } from "@/lib/auth/types";

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return base64ToBytes(padded);
}

async function hmacSign(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a[i] ^ b[i];
  return out === 0;
}

export async function signSessionToken(
  payload: Omit<SessionClaims, "iat" | "exp">,
  secret: string,
  ttlSec = 60 * 60 * 6,
) {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionClaims = {
    ...payload,
    iat: now,
    exp: now + ttlSec,
  };

  const headerPart = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payloadPart = toBase64Url(encoder.encode(JSON.stringify(fullPayload)));
  const input = `${headerPart}.${payloadPart}`;
  const signature = await hmacSign(input, secret);

  return `${input}.${toBase64Url(signature)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims | null> {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) return null;

  const input = `${headerPart}.${payloadPart}`;
  const expected = await hmacSign(input, secret);
  const actual = fromBase64Url(signaturePart);
  if (!constantTimeEqual(expected, actual)) return null;

  const payloadJson = new TextDecoder().decode(fromBase64Url(payloadPart));
  const payload = JSON.parse(payloadJson) as SessionClaims;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return null;

  return payload;
}
