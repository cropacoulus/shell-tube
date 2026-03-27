"use client";

import { useEffect, useState } from "react";
import { AccountAddress, Aptos, AptosConfig } from "@aptos-labs/ts-sdk";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  createDefaultErasureCodingProvider,
  expectedTotalChunksets,
  generateCommitments,
  ShelbyBlobClient,
} from "@shelby-protocol/sdk/browser";

import { resolveAppNetwork } from "@/lib/wallet/network";

type ProfileData = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: "student" | "creator" | "admin";
};

type ProfileClientProps = {
  initialProfile: ProfileData;
};

function normalizeAvatarUrl(avatarUrl?: string) {
  if (!avatarUrl) return undefined;
  if (avatarUrl.startsWith("/api/v1/storage/read/")) return avatarUrl;

  try {
    const parsed = new URL(avatarUrl);
    const marker = "/v1/blobs/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return avatarUrl;
    const blobKey = parsed.pathname
      .slice(markerIndex + marker.length)
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    return blobKey ? `/api/v1/storage/read/${blobKey}` : avatarUrl;
  } catch {
    return avatarUrl;
  }
}

const roleCopy: Record<ProfileData["role"], string> = {
  student: "Learning access is active. Apply for creator access when you are ready to publish.",
  creator: "Creator tools are unlocked. You can build drafts, attach media, and publish public courses.",
  admin: "Platform operations are unlocked, including creator review and content moderation surfaces.",
};

export default function ProfileClient({ initialProfile }: ProfileClientProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [creatorPitch, setCreatorPitch] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentAddress =
    typeof account?.address === "string"
      ? account.address
      : typeof account?.address?.toString === "function"
        ? account.address.toString()
        : null;

  async function loadProfile() {
    const res = await fetch("/api/v1/profile");
    if (!res.ok) return;
    const body = (await res.json()) as { data: ProfileData };
    setProfile(body.data);
    setDisplayName(body.data.displayName);
  }

  async function fetchLatestCreatorApplicationStatus() {
    const res = await fetch("/api/creator/applications");
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data: Array<{ status: "pending" | "approved" | "rejected"; updatedAt: string }>;
    };
    const latest = body.data[0];
    if (!latest) return null;
    return `${latest.status} · updated ${new Date(latest.updatedAt).toLocaleString()}`;
  }

  async function submitCreatorApplication() {
    setError(null);
    setStatus("Submitting creator application...");
    const res = await fetch("/api/creator/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pitch: creatorPitch }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Unable to submit creator application.");
      setStatus(null);
      return;
    }
    setCreatorPitch("");
    setStatus("Creator application submitted.");
    setApplicationStatus(await fetchLatestCreatorApplicationStatus());
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      const nextStatus = await fetchLatestCreatorApplicationStatus();
      if (active) {
        setApplicationStatus(nextStatus);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    setError(null);
    setStatus("Saving profile...");
    const res = await fetch("/api/v1/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) {
      setError("Unable to save profile.");
      setStatus(null);
      return;
    }
    setStatus("Profile saved.");
    await loadProfile();
  }

  async function uploadAvatar(file: File) {
    setError(null);
    try {
      if (!connected || !currentAddress || !signAndSubmitTransaction) {
        throw new Error("Connect the same wallet first so the Verra avatar blob can be registered on L1.");
      }
      if (currentAddress.toLowerCase() !== initialProfile.userId.toLowerCase()) {
        throw new Error("Connected wallet does not match the signed-in profile.");
      }

      const ext =
        file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "bin";
      const blobName = `profiles/avatar.${ext}`;
      const blobData = new Uint8Array(await file.arrayBuffer());

      setStatus("Registering Verra avatar blob on L1...");
      const provider = await createDefaultErasureCodingProvider();
      const commitment = await generateCommitments(provider, blobData);
      const chunksetSize = provider.config.erasure_k * provider.config.chunkSizeBytes;
      const expirationMicros = (Date.now() + 1000 * 60 * 60 * 24 * 30) * 1000;

      try {
        const pendingTx = await signAndSubmitTransaction({
          data: ShelbyBlobClient.createBatchRegisterBlobsPayload({
            account: AccountAddress.from(currentAddress),
            expirationMicros,
            blobs: [
              {
                blobName,
                blobSize: blobData.length,
                blobMerkleRoot: commitment.blob_merkle_root,
                numChunksets: expectedTotalChunksets(blobData.length, chunksetSize),
              },
            ],
            encoding: provider.config.enumIndex,
          }),
        });
        const aptos = new Aptos(new AptosConfig({ network: resolveAppNetwork() }));
        await aptos.waitForTransaction({
          transactionHash: pendingTx.hash,
        });
      } catch (registerError) {
        const message = registerError instanceof Error ? registerError.message : "";
        const alreadyRegistered =
          message.toLowerCase().includes("already exists") || message.toLowerCase().includes("ealready_exists");
        if (!alreadyRegistered) {
          throw registerError;
        }
      }

      setStatus("Uploading avatar...");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/profile/avatar", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || "Avatar upload failed.");
      }

      setStatus("Avatar uploaded.");
      await loadProfile();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Avatar upload failed.");
      setStatus(null);
    }
  }

  const displayIdentity = profile?.displayName || `${initialProfile.userId.slice(0, 6)}...${initialProfile.userId.slice(-4)}`;

  return (
    <div className="space-y-6">
      <section className="app-panel rounded-[2rem] p-6 md:p-8">
        <p className="app-kicker">Wallet profile</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-5xl">Set the identity the platform shows around your wallet.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/68 md:text-base">
          Your profile is the public face attached to course ownership, creator applications, and studio activity.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="app-panel rounded-[2rem] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={normalizeAvatarUrl(profile.avatarUrl)}
                alt="avatar"
                className="h-24 w-24 rounded-[1.5rem] border border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/6 text-3xl font-semibold">
                {profile?.userId?.slice(2, 4).toUpperCase() ?? "?"}
              </div>
            )}
            <div className="space-y-2">
              <span className="status-pill">{profile?.role ?? "-"}</span>
              <h2 className="text-2xl font-semibold">{displayIdentity}</h2>
              <p className="max-w-sm text-sm leading-7 text-white/65">{profile ? roleCopy[profile.role] : ""}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="app-panel-soft rounded-[1.35rem] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Wallet</p>
              <p className="mt-2 break-all text-sm text-white/76">{profile?.userId ?? "-"}</p>
            </div>
            <div className="app-panel-soft rounded-[1.35rem] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">Current access</p>
              <p className="mt-2 text-sm text-white/76 capitalize">{profile?.role ?? "-"}</p>
            </div>
          </div>
        </section>

        <section className="app-panel rounded-[2rem] p-6">
          <p className="app-kicker">Profile settings</p>
          <h2 className="mt-2 text-2xl font-semibold">Identity and avatar</h2>

          <label className="mt-5 block text-sm">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="form-shell mt-2"
            />
          </label>

          <label className="mt-4 block text-sm">
            Upload avatar
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAvatar(file);
              }}
              className="mt-2 block w-full text-xs text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
            />
          </label>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button onClick={saveProfile} className="app-primary-button w-full px-5 py-3 text-sm sm:w-auto">
              Save profile
            </button>
            {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </div>
        </section>
      </div>

      {profile?.role === "student" ? (
        <section className="app-panel rounded-[2rem] p-6">
          <p className="app-kicker">Creator access</p>
          <h2 className="mt-2 text-2xl font-semibold">Apply to become a creator</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
            Tell the platform what kind of course catalog you want to build. Once approved, Studio and creator analytics unlock automatically.
          </p>
          <textarea
            value={creatorPitch}
            onChange={(event) => setCreatorPitch(event.target.value)}
            placeholder="Describe the kind of educational content you want to publish."
            className="form-shell mt-4 min-h-32 text-sm"
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button onClick={submitCreatorApplication} className="app-primary-button w-full px-5 py-3 text-sm sm:w-auto">
              Submit application
            </button>
            {applicationStatus ? <span className="status-pill">{applicationStatus}</span> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
