"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Network } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { resolveAppNetwork } from "@/lib/wallet/network";

export default function SignInPage() {
  const router = useRouter();
  const { connect, disconnect, wallets, account, connected, signMessage, network, changeNetwork } = useWallet();
  const expectedNetwork = resolveAppNetwork();
  const currentAddress =
    typeof account?.address === "string"
      ? account.address
      : account?.address?.toString?.() ?? null;
  const [region, setRegion] = useState("ID");
  const [address, setAddress] = useState<string | null>(currentAddress);
  const [status, setStatus] = useState("Connect wallet to sign in.");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletName, setWalletName] = useState<string>(wallets[0]?.name || "");

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
        await connect(walletName || wallets[0].name);
      }
      await ensureWalletNetwork();

      const selectedAddress =
        (typeof account?.address === "string"
          ? account.address
          : account?.address?.toString?.()) ?? address;
      if (!selectedAddress) throw new Error("No wallet account available.");
      setAddress(selectedAddress);

      setStatus("Requesting Shelby sign-in challenge...");
      const challengeRes = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: selectedAddress, region }),
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
      const signature =
        typeof signed.signature === "string"
          ? signed.signature
          : signed.signature?.toString?.() ?? "";
      const publicKey = account?.publicKey?.toString?.() ?? "";
      if (!signature || !publicKey || !signed.fullMessage) {
        throw new Error("Wallet signature payload is incomplete.");
      }

      const verifyRes = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: selectedAddress,
          signature,
          publicKey,
          message: challengeBody.data.message,
          fullMessage: signed.fullMessage,
          nonce: challengeBody.data.nonce,
          region,
        }),
      });
      if (!verifyRes.ok) {
        const verifyBody = (await verifyRes.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(verifyBody?.error?.message || "Wallet signature verification failed.");
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a14] px-6 text-white">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-[#101626] p-6">
        <h1 className="text-2xl font-semibold">Wallet Sign In</h1>
        <p className="text-sm text-white/70">
          Sign in with your Aptos wallet to access Shelby-native streaming.
        </p>
        <label className="block text-sm">
          Wallet
          <select
            value={walletName}
            onChange={(event) => setWalletName(event.target.value)}
            className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
          >
            {wallets.map((wallet) => (
              <option value={wallet.name} key={wallet.name}>
                {wallet.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Region
          <input
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
          />
        </label>
        <button
          onClick={connectAndSign}
          disabled={loading}
          className="w-full rounded-md bg-white px-4 py-2 font-semibold text-black disabled:opacity-60"
        >
          {loading ? "Connecting..." : "Connect Wallet"}
        </button>
        {connected ? (
          <button
            onClick={() => void disconnect()}
            className="w-full rounded-md border border-white/20 px-4 py-2 text-sm"
          >
            Disconnect Wallet
          </button>
        ) : null}

        {address ? <p className="text-xs text-white/70">Connected: {address}</p> : null}
        <p className="text-xs text-cyan-200">{status}</p>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
