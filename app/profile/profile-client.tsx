"use client";

import { useState } from "react";

type ProfileData = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: "user" | "admin";
};

type ProfileClientProps = {
  initialProfile: ProfileData;
};

export default function ProfileClient({ initialProfile }: ProfileClientProps) {
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    const res = await fetch("/api/v1/profile");
    if (!res.ok) return;
    const body = (await res.json()) as { data: ProfileData };
    setProfile(body.data);
    setDisplayName(body.data.displayName);
  }

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

      {status ? <p className="text-sm text-cyan-200">{status}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
