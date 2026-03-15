import { cookies, headers } from "next/headers";

import { DEFAULT_REGION, WALLET_NONCE_COOKIE_NAME } from "@/lib/auth/constants";
import { buildWalletSignInMessage, isAptosAddress } from "@/lib/auth/wallet";

type WalletChallengeRequest = {
  address: string;
  chainId?: number;
  region?: string;
};

function isValid(body: unknown): body is WalletChallengeRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.address === "string";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValid(body) || !isAptosAddress(body.address)) {
    return Response.json(
      { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid wallet address" } },
      { status: 422 },
    );
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const issuedAt = new Date().toISOString();
  const headerStore = await headers();
  const host = headerStore.get("host") || "localhost:3000";
  const domain = host.replace(/:\d+$/, "");
  const region = body.region || DEFAULT_REGION;

  const message = buildWalletSignInMessage({
    domain,
    address: body.address,
    nonce,
    chainId: body.chainId,
    issuedAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(
    WALLET_NONCE_COOKIE_NAME,
    JSON.stringify({ nonce, address: body.address.toLowerCase(), issuedAt, region, message }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 5,
    },
  );

  return Response.json({
    ok: true,
    data: { message, nonce, issuedAt, region },
  });
}
