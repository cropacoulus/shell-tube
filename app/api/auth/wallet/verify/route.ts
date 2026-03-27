import { cookies } from "next/headers";

import {
  DEFAULT_REGION,
  WALLET_NONCE_COOKIE_NAME,
} from "@/lib/auth/constants";
import { normalizeUserRole } from "@/lib/auth/capabilities";
import { verifyAptosSignatureCandidates } from "@/lib/auth/aptos-signature";
import { getUserRoleKind } from "@/lib/blockchain/role-registry";
import { signSessionToken } from "@/lib/auth/jwt";
import { getSessionAuthSecret } from "@/lib/auth/session-secret";
import { isAptosAddress } from "@/lib/auth/wallet";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getProfileFromProjection } from "@/lib/projections/profile-read-model";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getEventStore, getProfileRepository } from "@/lib/repositories";

type WalletVerifyRequest = {
  address: string;
  signature: string;
  publicKey: string;
  signatureCandidates?: string[];
  publicKeyCandidates?: string[];
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
    (candidate.signatureCandidates === undefined ||
      (Array.isArray(candidate.signatureCandidates) &&
        candidate.signatureCandidates.every((item) => typeof item === "string"))) &&
    (candidate.publicKeyCandidates === undefined ||
      (Array.isArray(candidate.publicKeyCandidates) &&
        candidate.publicKeyCandidates.every((item) => typeof item === "string"))) &&
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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body) || !isAptosAddress(body.address)) {
    return Response.json(
      { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid wallet verification payload" } },
      { status: 422 },
    );
  }

  const secret = getSessionAuthSecret();

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

  const {
    verified,
    verifyError,
    attempts: verifyAttempts,
  } = await verifyAptosSignatureCandidates({
    fullMessage: body.fullMessage,
    message: body.message,
    publicKey: body.publicKey,
    signature: body.signature,
    publicKeyCandidates: body.publicKeyCandidates,
    signatureCandidates: body.signatureCandidates,
  });

  if (!verified) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_SIGNATURE",
          message: !verifyError
            ? "Aptos signature verification failed"
            : `Aptos signature verification failed: ${verifyError}`,
          details: verifyAttempts,
        },
      },
      { status: 401 },
    );
  }

  const optionB = createOptionBConfig();
  const existingProfile = optionB.projectionStoreBackend === "upstash"
    ? await getProfileFromProjection(body.address.toLowerCase())
    : await getProfileRepository().getProfile(body.address.toLowerCase());
  const role = normalizeUserRole(await getUserRoleKind(body.address.toLowerCase()));

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

  const updatedProfile = {
    userId: body.address.toLowerCase(),
    displayName: existingProfile?.displayName ?? `${body.address.slice(0, 6)}...${body.address.slice(-4)}`,
    avatarUrl: existingProfile?.avatarUrl,
    role,
    updatedAt: new Date().toISOString(),
  };
  if (optionB.projectionStoreBackend !== "upstash") {
    await getProfileRepository().upsertProfile(updatedProfile);
  }
  await getEventStore().appendEvent(
    createDomainEvent({
      type: "profile_updated",
      aggregateType: "profile",
      aggregateId: updatedProfile.userId,
      actor: {
        userId: updatedProfile.userId,
        role,
      },
      idempotencyKey: buildEventIdempotencyKey(
        "wallet-verify-profile-sync",
        updatedProfile.userId,
        updatedProfile.updatedAt,
      ),
      payload: updatedProfile,
    }),
  );
  await runProjectionBatch(200);

  cookieStore.delete(WALLET_NONCE_COOKIE_NAME);

  return Response.json({
    ok: true,
    data: {
      address: body.address.toLowerCase(),
      role,
      accessToken: token,
    },
  });
}
