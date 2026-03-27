"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Network, Serializer } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { setStoredAccessToken } from "@/lib/client/access-token";
import { resolveAppNetwork } from "@/lib/wallet/network";

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

export default function SignInPage() {
  const router = useRouter();
  const { connect, disconnect, wallets, account, connected, signMessage, network, changeNetwork, wallet } = useWallet();
  const expectedNetwork = resolveAppNetwork();
  const [region, setRegion] = useState("ID");
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState("Connect wallet to sign in.");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletName, setWalletName] = useState<string>(wallets[0]?.name || "");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const accountRef = useRef(account);
  const connectedRef = useRef(connected);

  useEffect(() => {
    const localeRegion = typeof navigator !== "undefined" ? navigator.language.split("-")[1] : null;
    if (localeRegion && localeRegion.length === 2) {
      setRegion(localeRegion.toUpperCase());
    }
  }, []);

  useEffect(() => {
    accountRef.current = account;
    connectedRef.current = connected;
    const nextAddress =
      typeof account?.address === "string"
        ? account.address
        : account?.address?.toString?.() ?? null;
    setAddress(nextAddress);
  }, [account, connected]);

  useEffect(() => {
    if (walletName || wallets.length === 0) return;
    setWalletName(wallets[0]?.name || "");
  }, [walletName, wallets]);

  async function waitForWalletAccount() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const nextAccount = accountRef.current;
      const nextConnected = connectedRef.current;
      const nextAddress =
        typeof nextAccount?.address === "string"
          ? nextAccount.address
          : nextAccount?.address?.toString?.() ?? null;
      const nextPublicKey = normalizeWalletValue(nextAccount?.publicKey);

      if (nextConnected && nextAddress && nextPublicKey) {
        return {
          address: nextAddress,
          publicKey: nextPublicKey,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    throw new Error("Wallet connected but account details were not ready. Wait a moment and try again.");
  }

  async function ensureWalletNetwork() {
    const walletNetwork = network?.name;
    if (!walletNetwork || walletNetwork === expectedNetwork) return;
    try {
      await changeNetwork(expectedNetwork as Network);
    } catch {
      throw new Error(
        `Wallet network is ${walletNetwork}. Switch wallet to ${expectedNetwork} and try again.`,
      );
    }
  }

  async function connectAndSign() {
    setError(null);
    setLoading(true);
    try {
      if (wallets.length === 0) {
        throw new Error("No Aptos wallet found. Install Petra, Martian, or similar wallet.");
      }

      if (!connected) {
        setStatus("Connecting wallet...");
        await connect(walletName || wallets[0].name);
      }
      const walletAccount = await waitForWalletAccount();
      await ensureWalletNetwork();
      setAddress(walletAccount.address);

      setStatus("Requesting Verra sign-in challenge...");
      const challengeRes = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: walletAccount.address, region }),
      });
      if (!challengeRes.ok) {
        throw new Error("Could not create wallet challenge.");
      }

      const challengeBody = (await challengeRes.json()) as {
        data: { message: string; nonce: string };
      };

      setStatus("Waiting for wallet signature...");
      const signed = await signMessage({
        address: true,
        application: true,
        chainId: true,
        message: challengeBody.data.message,
        nonce: challengeBody.data.nonce,
      });
      const signatureSerialized = serializeAptosValue(signed.signature);
      const signatureRaw = normalizeWalletValue(signed.signature);
      const signedPublicKeySerialized = serializeAptosValue((signed as { publicKey?: unknown }).publicKey);
      const signedPublicKeyRaw = normalizeWalletValue((signed as { publicKey?: unknown }).publicKey);
      const publicKeySerialized = serializeAptosValue(accountRef.current?.publicKey);
      const publicKeyRaw = normalizeWalletValue(accountRef.current?.publicKey);
      const signedAddress = typeof signed.address === "string" ? signed.address.toLowerCase() : walletAccount.address.toLowerCase();
      if ((!signatureSerialized && !signatureRaw) || (!signedPublicKeySerialized && !signedPublicKeyRaw && !publicKeySerialized && !publicKeyRaw) || !signed.fullMessage) {
        throw new Error("Wallet signature payload is incomplete.");
      }

      const verifyRes = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: signedAddress,
          signature: signatureSerialized || signatureRaw,
          publicKey: signedPublicKeySerialized || signedPublicKeyRaw || publicKeySerialized || publicKeyRaw,
          signatureCandidates: uniqueValues([signatureSerialized, signatureRaw]),
          publicKeyCandidates: uniqueValues([signedPublicKeySerialized, signedPublicKeyRaw, publicKeySerialized, publicKeyRaw]),
          message: challengeBody.data.message,
          fullMessage: signed.fullMessage,
          nonce: challengeBody.data.nonce,
          region,
        }),
      });
      if (!verifyRes.ok) {
        const verifyBody = (await verifyRes.json().catch(() => null)) as
          | { error?: { message?: string; details?: string[] } }
          | null;
        const detailText = verifyBody?.error?.details?.filter(Boolean).join(" | ");
        throw new Error(
          [verifyBody?.error?.message || "Wallet signature verification failed.", detailText]
            .filter(Boolean)
            .join("\n"),
        );
      }
      const verifyBody = (await verifyRes.json()) as {
        data?: {
          accessToken?: string;
        };
      };
      if (verifyBody.data?.accessToken) {
        setStoredAccessToken(verifyBody.data.accessToken);
      }

      setStatus("Signed in. Redirecting...");
      const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet sign-in failed.";
      setError(message);
      setStatus("Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletSelection(nextWalletName: string) {
    setWalletName(nextWalletName);
    setWalletModalOpen(false);
    setError(null);
    setStatus("Connecting wallet...");
    try {
      if (connected) {
        await disconnect();
      }
      await connect(nextWalletName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect wallet.";
      setError(message);
      setStatus("Wallet connection failed.");
    }
  }

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-6 py-12 text-white">
      <div className="grid w-full max-w-5xl gap-6 md:grid-cols-[1.05fr_0.95fr]">
        <section className="app-panel rounded-[2rem] p-8">
          <p className="app-kicker">Wallet-native entry</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">Enter the creator learning network with your Aptos wallet.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/68">
            Verra treats the wallet as the front door for identity, creator access, and playback authorization. One sign-in unlocks catalog, studio, and audience data.
          </p>
          <div className="mt-8 grid gap-3">
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Access</p>
              <p className="mt-2 text-lg font-semibold">Student, creator, and admin flows use the same wallet session.</p>
            </div>
            <div className="metric-card">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Delivery</p>
              <p className="mt-2 text-lg font-semibold">Playback and media distribution stay aligned with Verra media delivery on Shelby-backed storage.</p>
            </div>
          </div>
        </section>

        <section className="app-panel rounded-[2rem] p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Connect wallet</h2>
              <p className="mt-2 text-sm text-white/68">
                Use the wallet you want to learn or publish with.
              </p>
            </div>
            {wallet ? <span className="status-pill">{wallet.name}</span> : null}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/4 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Selected wallet</p>
            <div className="mt-3 flex items-center gap-3">
              {wallet?.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={wallet.icon} alt={wallet.name} className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-[#f4a261]">
                  {walletName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold">{wallet?.name || walletName || "No wallet selected"}</p>
                <p className="mt-1 text-sm text-white/60">
                  {connected ? "Connected and ready for signature" : "Choose a wallet from the modal first"}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setWalletModalOpen(true)}
            className="app-secondary-button mt-5 w-full px-4 py-3 text-sm"
          >
            {connected ? "Switch wallet" : "Choose wallet"}
          </button>

          
          <button
            onClick={connectAndSign}
            disabled={loading}
            className="app-primary-button mt-6 w-full px-4 py-3 text-sm disabled:opacity-60"
      >
          {loading ? "Working..." : connected ? "Sign in with connected wallet" : "Connect wallet"}
        </button>
          {connected ? (
            <button
              onClick={() => void disconnect()}
              className="app-secondary-button mt-3 w-full px-4 py-3 text-sm"
            >
              Disconnect wallet
            </button>
          ) : null}

          {address ? <p className="mt-4 text-xs text-white/60">Connected: {address}</p> : null}
          <p className="mt-3 text-xs text-cyan-200">{status}</p>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </section>
      </div>

      {walletModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#03101a]/82 px-4 backdrop-blur-md">
          <div className="app-panel w-full max-w-lg rounded-[2rem] p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">Wallet selector</p>
                <h3 className="mt-2 text-2xl font-semibold">Choose a wallet</h3>
                <p className="mt-2 text-sm leading-7 text-white/65">
                  Pick the wallet you want to use for learning, creator tools, or admin access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWalletModalOpen(false)}
                className="app-secondary-button px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {wallets.map((walletOption) => {
                const isSelected = walletName === walletOption.name;
                return (
                  <button
                    key={walletOption.name}
                    type="button"
                    onClick={() => void handleWalletSelection(walletOption.name)}
                    className={`flex w-full items-center justify-between rounded-[1.4rem] border px-4 py-4 text-left transition ${
                      isSelected
                        ? "border-[#f4a261]/50 bg-[#f4a261]/10"
                        : "border-white/10 bg-white/4 hover:bg-white/7"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {walletOption.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={walletOption.icon} alt={walletOption.name} className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-[#f4a261]">
                          {walletOption.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-base font-semibold">{walletOption.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                          {isSelected ? "Current selection" : "Tap to connect"}
                        </p>
                      </div>
                    </div>
                    <span className="status-pill">{isSelected ? "Selected" : "Available"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
