"use client";

import { useEffect, useState } from "react";

type ProfileData = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: "student" | "creator" | "admin";
};

type ProfileClientProps = {
  initialProfile: ProfileData;
};

export default function ProfileClient({ initialProfile }: ProfileClientProps) {
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [creatorPitch, setCreatorPitch] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!latest) {
      return null;
    }
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
    setStatus("Uploading avatar...");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/v1/profile/avatar", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      setError("Avatar upload failed. Ensure Shelby RPC storage is configured.");
      setStatus(null);
      return;
    }
    setStatus("Avatar uploaded.");
    await loadProfile();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-[#10141f] p-6">
      <h1 className="text-2xl font-semibold">Wallet Profile</h1>
      <div className="flex items-center gap-4">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="avatar" className="h-20 w-20 rounded-full border border-white/20 object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl">
            {profile?.userId?.slice(2, 4).toUpperCase() ?? "?"}
          </div>
        )}
        <div className="space-y-1 text-sm text-white/75">
          <p>{profile?.userId ?? "-"}</p>
          <p>Role: {profile?.role ?? "-"}</p>
        </div>
      </div>

      <label className="block text-sm">
        Display Name
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        Upload Avatar
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAvatar(file);
          }}
          className="mt-1 block w-full text-xs"
        />
      </label>

      <button onClick={saveProfile} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
        Save Profile
      </button>

      {profile?.role === "student" ? (
        <section className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h2 className="text-lg font-semibold">Apply for Creator Access</h2>
          <p className="mt-2 text-sm text-white/70">
            Submit a short pitch. Admin can review and approve your wallet for creator tools.
          </p>
          <textarea
            value={creatorPitch}
            onChange={(event) => setCreatorPitch(event.target.value)}
            placeholder="Describe the kind of educational content you want to publish."
            className="mt-3 min-h-28 w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={submitCreatorApplication}
              className="rounded-md border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              Submit Application
            </button>
            {applicationStatus ? <p className="text-xs text-white/55">Latest application: {applicationStatus}</p> : null}
          </div>
        </section>
      ) : null}

      {status ? <p className="text-sm text-cyan-200">{status}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
