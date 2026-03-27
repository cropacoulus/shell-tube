import { jsonError } from "@/lib/server/http";

type WalletActionProof = {
  address: string;
  message: string;
  fullMessage: string;
  signature: string;
  publicKey: string;
  timestamp: string;
  action: string;
  signatureCandidates?: string[];
  publicKeyCandidates?: string[];
};

export function buildWalletActionMessage(input: {
  address: string;
  action: string;
  timestamp: string;
}) {
  return [
    "Authorize this Verra action with your Aptos wallet.",
    "",
    `Address: ${input.address.toLowerCase()}`,
    `Action: ${input.action}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}

function parseHeaderArray(raw: string | null) {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return undefined;
  }
}

export function getWalletActionFromHeaders(headerMap: Headers): WalletActionProof | null {
  const address = headerMap.get("x-wallet-address");
  const message = headerMap.get("x-wallet-message");
  const fullMessage = headerMap.get("x-wallet-full-message");
  const signature = headerMap.get("x-wallet-signature");
  const publicKey = headerMap.get("x-wallet-public-key");
  const timestamp = headerMap.get("x-wallet-timestamp");
  const action = headerMap.get("x-wallet-action");
  if (!address || !message || !fullMessage || !signature || !publicKey || !timestamp || !action) return null;
  return {
    address,
    message,
    fullMessage,
    signature,
    publicKey,
    timestamp,
    action,
    signatureCandidates: parseHeaderArray(headerMap.get("x-wallet-signature-candidates")),
    publicKeyCandidates: parseHeaderArray(headerMap.get("x-wallet-public-key-candidates")),
  };
}

export function validateWalletActionEnvelope(input: {
  proof: WalletActionProof;
  method: string;
  pathname: string;
  expectedAddress: string;
}) {
  const expectedAction = `${input.method.toUpperCase()} ${input.pathname}`;
  const expectedMessage = buildWalletActionMessage({
    address: input.proof.address,
    action: expectedAction,
    timestamp: input.proof.timestamp,
  });

  if (input.proof.address.toLowerCase() !== input.expectedAddress.toLowerCase()) {
    return jsonError("INVALID_SIGNATURE", "Wallet proof does not match the authenticated wallet.", 401);
  }
  if (input.proof.action !== expectedAction) {
    return jsonError("INVALID_SIGNATURE", "Wallet action proof is bound to a different route.", 401);
  }
  if (input.proof.message !== expectedMessage || !input.proof.fullMessage.includes(input.proof.message)) {
    return jsonError("INVALID_SIGNATURE", "Wallet action message mismatch.", 401);
  }

  const issuedAt = Number(input.proof.timestamp);
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60_000) {
    return jsonError("INVALID_SIGNATURE", "Wallet action proof expired.", 401);
  }

  return null;
}
