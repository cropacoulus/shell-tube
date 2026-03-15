import { cookies } from "next/headers";
import {
  Ed25519PublicKey,
  Ed25519Signature,
  PublicKey,
  Signature,
  deserializePublicKey,
  deserializeSignature,
} from "@aptos-labs/ts-sdk";

import {
  DEFAULT_REGION,
  SESSION_COOKIE_NAME,
  WALLET_NONCE_COOKIE_NAME,
} from "@/lib/auth/constants";
import { signSessionToken } from "@/lib/auth/jwt";
import { isAdminWallet, isAptosAddress } from "@/lib/auth/wallet";
import { upsertProfile } from "@/lib/server/data-store";

type WalletVerifyRequest = {
  address: string;
  signature: string;
  publicKey: string;
  message: string;
  fullMessage: string;
  nonce: string;
  profileId?: string;
  region?: string;
};

type NonceCookiePayload = {
  nonce: string;
  address: string;
  issuedAt: string;
  region: string;
  message?: string;
};

function isValid(body: unknown): body is WalletVerifyRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.address === "string" &&
    typeof candidate.signature === "string" &&
    typeof candidate.publicKey === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.fullMessage === "string" &&
    typeof candidate.nonce === "string"
  );
}

function parseNoncePayload(raw: string | undefined): NonceCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NonceCookiePayload;
    if (
      typeof parsed.nonce !== "string" ||
      typeof parsed.address !== "string" ||
      typeof parsed.issuedAt !== "string" ||
      typeof parsed.region !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parsePublicKey(input: string): PublicKey {
  try {
    return deserializePublicKey(input);
  } catch {
    return new Ed25519PublicKey(input);
  }
}

function parseSignature(input: string): Signature {
  try {
    return deserializeSignature(input);
  } catch {
    return new Ed25519Signature(input);
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body) || !isAptosAddress(body.address)) {
    return Response.json(
      { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid wallet verification payload" } },
      { status: 422 },
    );
  }

  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: { code: "SERVER_MISCONFIGURED", message: "AUTH_JWT_SECRET is not set" } },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const noncePayload = parseNoncePayload(cookieStore.get(WALLET_NONCE_COOKIE_NAME)?.value);
  if (!noncePayload) {
    return Response.json(
      { ok: false, error: { code: "MISSING_CHALLENGE", message: "Missing or expired wallet challenge" } },
      { status: 401 },
    );
  }

  if (!body.message.includes(`Nonce: ${noncePayload.nonce}`)) {
    return Response.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Challenge nonce mismatch" } },
      { status: 401 },
    );
  }

  if (!body.message.toLowerCase().includes(noncePayload.address.toLowerCase())) {
    return Response.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Challenge address mismatch" } },
      { status: 401 },
    );
  }

  const issuedAtMs = new Date(noncePayload.issuedAt).getTime();
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > 5 * 60_000) {
    return Response.json(
      { ok: false, error: { code: "CHALLENGE_EXPIRED", message: "Wallet challenge expired" } },
      { status: 401 },
    );
  }

  if (body.address.toLowerCase() !== noncePayload.address.toLowerCase()) {
    return Response.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Challenge address mismatch" } },
      { status: 401 },
    );
  }

  if (body.nonce !== noncePayload.nonce) {
    return Response.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Challenge nonce mismatch" } },
      { status: 401 },
    );
  }

  if (noncePayload.message && body.message !== noncePayload.message) {
    return Response.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Challenge message mismatch" } },
      { status: 401 },
    );
  }

  const nonceRegex = new RegExp(`nonce:\\s*${body.nonce}`, "i");
  if (!body.fullMessage.includes(body.message) || !nonceRegex.test(body.fullMessage)) {
    return Response.json(
      { ok: false, error: { code: "INVALID_CHALLENGE", message: "Malformed signed payload" } },
      { status: 401 },
    );
  }

  let verified = false;
  let verifyError = "";
  try {
    const publicKey = parsePublicKey(body.publicKey);
    const signature = parseSignature(body.signature);
    verified = publicKey.verifySignature({
      message: new TextEncoder().encode(body.fullMessage),
      signature,
    });
  } catch (error) {
    verifyError = error instanceof Error ? error.message : "Unknown signature error";
    verified = false;
  }

  if (!verified) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_SIGNATURE",
          message:
            process.env.NODE_ENV === "production" || !verifyError
              ? "Aptos signature verification failed"
              : `Aptos signature verification failed: ${verifyError}`,
        },
      },
      { status: 401 },
    );
  }

  const role = isAdminWallet(body.address) ? "admin" : "user";

  const token = await signSessionToken(
    {
      sub: body.address.toLowerCase(),
      profileId: body.profileId || "wallet-main",
      region: body.region || noncePayload.region || DEFAULT_REGION,
      sessionId: crypto.randomUUID(),
      role,
    },
    secret,
  );

  await upsertProfile({
    userId: body.address.toLowerCase(),
    displayName: `${body.address.slice(0, 6)}...${body.address.slice(-4)}`,
    role,
    updatedAt: new Date().toISOString(),
  });

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 6,
  });
  cookieStore.delete(WALLET_NONCE_COOKIE_NAME);

  return Response.json({
    ok: true,
    data: {
      address: body.address.toLowerCase(),
    },
  });
}
