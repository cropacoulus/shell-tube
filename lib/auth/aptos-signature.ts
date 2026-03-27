import {
  AptosConfig,
  Ed25519PublicKey,
  Ed25519Signature,
  PublicKey,
  Signature,
  deserializePublicKey,
  deserializeSignature,
} from "@aptos-labs/ts-sdk";

import { resolveAppNetwork } from "@/lib/wallet/network";

export function parsePublicKey(input: string): PublicKey {
  try {
    return deserializePublicKey(input);
  } catch {
    return new Ed25519PublicKey(input);
  }
}

export function parseSignature(input: string): Signature {
  try {
    return deserializeSignature(input);
  } catch {
    const normalized = input.startsWith("0x") ? input.slice(2) : input;
    if (normalized.length === 128) {
      return new Ed25519Signature(`0x${normalized}`);
    }
    if (normalized.length === 130 && normalized.startsWith("40")) {
      return new Ed25519Signature(`0x${normalized.slice(2)}`);
    }
    return new Ed25519Signature(input);
  }
}

export async function verifyAptosSignatureCandidates(input: {
  fullMessage: string;
  message?: string;
  publicKey: string;
  signature: string;
  publicKeyCandidates?: string[];
  signatureCandidates?: string[];
}) {
  const attempts: string[] = [];
  let verified = false;
  let verifyError = "";
  const publicKeyCandidates = Array.from(new Set([input.publicKey, ...(input.publicKeyCandidates ?? [])]));
  const signatureCandidates = Array.from(new Set([input.signature, ...(input.signatureCandidates ?? [])]));
  const messageCandidates = Array.from(
    new Set([input.fullMessage, input.message].filter((value): value is string => Boolean(value))),
  );

  for (const publicKeyValue of publicKeyCandidates) {
    let publicKey: PublicKey;
    try {
      publicKey = parsePublicKey(publicKeyValue);
      attempts.push(`publicKey ok (${publicKey.constructor.name}) len=${publicKeyValue.replace(/^0x/, "").length}`);
    } catch (error) {
      verifyError = error instanceof Error ? error.message : "Unable to parse public key";
      attempts.push(`publicKey fail len=${publicKeyValue.replace(/^0x/, "").length}: ${verifyError}`);
      continue;
    }

    for (const signatureValue of signatureCandidates) {
      const signature = (() => {
        try {
          const parsed = parseSignature(signatureValue);
          attempts.push(`signature ok (${parsed.constructor.name}) len=${signatureValue.replace(/^0x/, "").length}`);
          return parsed;
        } catch (error) {
          verifyError = error instanceof Error ? error.message : "Unknown signature error";
          attempts.push(`signature parse fail len=${signatureValue.replace(/^0x/, "").length}: ${verifyError}`);
          return null;
        }
      })();
      if (!signature) {
        continue;
      }

      for (const messageCandidate of messageCandidates) {
        const messageBytes = new TextEncoder().encode(messageCandidate);
        try {
          if ("verifySignatureAsync" in publicKey && typeof publicKey.verifySignatureAsync === "function") {
            verified = await publicKey.verifySignatureAsync({
              aptosConfig: new AptosConfig({ network: resolveAppNetwork() }),
              message: messageBytes,
              signature,
              options: {
                throwErrorWithReason: true,
              },
            });
          } else {
            verified = publicKey.verifySignature({
              message: messageBytes,
              signature,
            });
          }
          attempts.push(`verify result=${verified} msgLen=${messageCandidate.length}`);
        } catch (error) {
          verifyError = error instanceof Error ? error.message : "Unknown signature error";
          verified = false;
          attempts.push(`signature/verify fail len=${signatureValue.replace(/^0x/, "").length} msgLen=${messageCandidate.length}: ${verifyError}`);
        }

        if (verified) break;
      }

      if (verified) break;
    }

    if (verified) break;
  }

  return {
    verified,
    attempts,
    verifyError,
  };
}
