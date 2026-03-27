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
  publicKey: string;
  signature: string;
  publicKeyCandidates?: string[];
  signatureCandidates?: string[];
}) {
  const attempts: string[] = [];
  let verified = false;
  let verifyError = "";
  const messageBytes = new TextEncoder().encode(input.fullMessage);
  const publicKeyCandidates = Array.from(new Set([input.publicKey, ...(input.publicKeyCandidates ?? [])]));
  const signatureCandidates = Array.from(new Set([input.signature, ...(input.signatureCandidates ?? [])]));

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
      try {
        const signature = parseSignature(signatureValue);
        attempts.push(`signature ok (${signature.constructor.name}) len=${signatureValue.replace(/^0x/, "").length}`);
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
        attempts.push(`verify result=${verified}`);
      } catch (error) {
        verifyError = error instanceof Error ? error.message : "Unknown signature error";
        verified = false;
        attempts.push(`signature/verify fail len=${signatureValue.replace(/^0x/, "").length}: ${verifyError}`);
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
