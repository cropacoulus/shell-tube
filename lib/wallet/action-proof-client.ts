"use client";

import { Serializer } from "@aptos-labs/ts-sdk";

import { getBearerAuthHeaders } from "@/lib/client/access-token";
import { buildWalletActionMessage } from "@/lib/auth/wallet-action";

function bytesToHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeWalletValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item): item is string => typeof item === "string" && item.length > 0);
    return first ?? "";
  }
  if (
    value &&
    typeof value === "object" &&
    "toUint8Array" in value &&
    typeof (value as { toUint8Array: () => Uint8Array }).toUint8Array === "function"
  ) {
    return bytesToHex((value as { toUint8Array: () => Uint8Array }).toUint8Array());
  }
  if (value && typeof value === "object" && "data" in value && value.data instanceof Uint8Array) {
    return bytesToHex(value.data);
  }
  if (value && typeof value === "object" && typeof value.toString === "function") {
    const rendered = value.toString();
    if (rendered && rendered !== "[object Object]") return rendered;
  }
  return "";
}

function serializeAptosValue(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "serialize" in value &&
    typeof (value as { serialize: (serializer: Serializer) => void }).serialize === "function"
  ) {
    const serializer = new Serializer();
    (value as { serialize: (serializer: Serializer) => void }).serialize(serializer);
    return bytesToHex(serializer.toUint8Array());
  }
  return normalizeWalletValue(value);
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

type BuildWalletActionHeadersInput = {
  address: string;
  publicKey: unknown;
  signMessage: (input: {
    address?: boolean;
    application?: boolean;
    chainId?: boolean;
    message: string;
    nonce: string;
  }) => Promise<{
    address?: string;
    fullMessage: string;
    signature: unknown;
  }>;
  method: string;
  pathname: string;
};

export async function buildWalletActionHeaders(input: BuildWalletActionHeadersInput) {
  const timestamp = String(Date.now());
  const action = `${input.method.toUpperCase()} ${input.pathname}`;
  const message = buildWalletActionMessage({
    address: input.address.toLowerCase(),
    action,
    timestamp,
  });

  const signed = await input.signMessage({
    address: true,
    application: true,
    chainId: true,
    message,
    nonce: timestamp,
  });

  const signatureSerialized = serializeAptosValue(signed.signature);
  const signatureRaw = normalizeWalletValue(signed.signature);
  const publicKeySerialized = serializeAptosValue(input.publicKey);
  const publicKeyRaw = normalizeWalletValue(input.publicKey);
  const signedAddress = typeof signed.address === "string" ? signed.address.toLowerCase() : input.address.toLowerCase();

  if ((!signatureSerialized && !signatureRaw) || (!publicKeySerialized && !publicKeyRaw) || !signed.fullMessage) {
    throw new Error("Wallet action signature payload is incomplete.");
  }

  return {
    ...getBearerAuthHeaders(),
    "x-wallet-address": signedAddress,
    "x-wallet-message": message,
    "x-wallet-full-message": signed.fullMessage,
    "x-wallet-signature": signatureSerialized || signatureRaw,
    "x-wallet-public-key": publicKeySerialized || publicKeyRaw,
    "x-wallet-timestamp": timestamp,
    "x-wallet-action": action,
    "x-wallet-signature-candidates": JSON.stringify(uniqueValues([signatureSerialized, signatureRaw])),
    "x-wallet-public-key-candidates": JSON.stringify(uniqueValues([publicKeySerialized, publicKeyRaw])),
  } satisfies Record<string, string>;
}
