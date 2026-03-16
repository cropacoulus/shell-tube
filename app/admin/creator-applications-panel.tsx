"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "@/lib/contracts/profile";

type CreatorApplication = {
  id: string;
  userId: string;
  displayName: string;
  pitch: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
};

export default function CreatorApplicationsPanel() {
  const [items, setItems] = useState<CreatorApplication[]>([]);
  const [creators, setCreators] = useState<UserProfile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/v1/admin/creator-applications");
    if (!res.ok) return;
    const body = (await res.json()) as {
      data: {
        pendingApplications: CreatorApplication[];
        creators: UserProfile[];
      };
    };
    setItems(body.data.pendingApplications);
    setCreators(body.data.creators);
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const res = await fetch("/api/v1/admin/creator-applications");
      if (!res.ok || !active) return;
      const body = (await res.json()) as {
        data: {
          pendingApplications: CreatorApplication[];
          creators: UserProfile[];
        };
      };
      if (!active) return;
      setItems(body.data.pendingApplications);
      setCreators(body.data.creators);
    })();

    return () => {
      active = false;
    };
  }, [loadData]);

  async function reviewApplication(id: string, statusValue: "approved" | "rejected") {
    setError(null);
    setStatus(null);
    const res = await fetch("/api/v1/admin/creator-applications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: statusValue }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message || "Failed to review creator application.");
      return;
    }
    setStatus(statusValue === "approved" ? "Creator application approved." : "Creator application rejected.");
    await loadData();
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#10141f] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pending Creator Applications</h2>
          <p className="mt-1 text-sm text-white/60">Each application can only be reviewed once. Approved creators move to the active creator list below.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.displayName}</p>
                <p className="mt-1 text-xs text-white/55">{item.userId}</p>
                <p className="mt-3 text-sm text-white/75">{item.pitch}</p>
                <p className="mt-2 text-xs text-white/45">Submitted {new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void reviewApplication(item.id, "approved")}
                  className="rounded-md border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void reviewApplication(item.id, "rejected")}
                  className="rounded-md border border-rose-300/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )) : (
          <p className="text-sm text-white/65">No pending creator applications.</p>
        )}
      </div>
      <div className="mt-6 border-t border-white/10 pt-5">
        <div>
          <h3 className="text-lg font-semibold">Active Creators</h3>
          <p className="mt-1 text-sm text-white/60">Wallets that already have creator access.</p>
        </div>
        <div className="mt-4 space-y-2">
          {creators.length > 0 ? creators.map((creator) => (
            <div key={creator.userId} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="font-medium">{creator.displayName}</p>
              <p className="mt-1 text-xs text-white/55">{creator.userId}</p>
              <p className="mt-2 text-xs text-white/45">Updated {new Date(creator.updatedAt).toLocaleString()}</p>
            </div>
          )) : (
            <p className="text-sm text-white/65">No active creators yet.</p>
          )}
        </div>
      </div>
      {status ? <p className="mt-4 text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
