import { verifyAptosSignatureCandidates } from "@/lib/auth/aptos-signature";
import {
  getWalletActionFromHeaders,
  validateWalletActionEnvelope,
} from "@/lib/auth/wallet-action";
import { jsonError } from "@/lib/server/http";

export async function requireWalletActionProof(req: Request, expectedAddress: string) {
  const proof = getWalletActionFromHeaders(req.headers);
  if (!proof) {
    return {
      ok: false as const,
      response: jsonError("UNAUTHORIZED", "Wallet action signature is required.", 401),
    };
  }

  const { pathname } = new URL(req.url);
  const envelopeError = validateWalletActionEnvelope({
    proof,
    method: req.method,
    pathname,
    expectedAddress,
  });
  if (envelopeError) {
    return { ok: false as const, response: envelopeError };
  }

  const verification = await verifyAptosSignatureCandidates({
    fullMessage: proof.fullMessage,
    publicKey: proof.publicKey,
    signature: proof.signature,
    publicKeyCandidates: proof.publicKeyCandidates,
    signatureCandidates: proof.signatureCandidates,
  });
  if (!verification.verified) {
    return {
      ok: false as const,
      response: jsonError(
        "INVALID_SIGNATURE",
        verification.verifyError
          ? `Wallet action signature verification failed: ${verification.verifyError}`
          : "Wallet action signature verification failed.",
        401,
      ),
    };
  }

  return {
    ok: true as const,
    address: proof.address.toLowerCase(),
  };
}
