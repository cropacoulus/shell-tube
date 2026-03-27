"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import type { UserProfile } from "@/lib/contracts/profile";
import { authFetch } from "@/lib/client/auth-fetch";
import { buildWalletActionHeaders } from "@/lib/wallet/action-proof-client";

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
  const { account, signMessage } = useWallet();
  const [items, setItems] = useState<CreatorApplication[]>([]);
  const [creators, setCreators] = useState<UserProfile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentAddress =
    typeof account?.address === "string"
      ? account.address
      : account?.address?.toString?.() ?? null;

  async function buildActionHeaders(method: "PATCH", pathname: string) {
    if (!currentAddress || !account?.publicKey || !signMessage) {
      throw new Error("Connect the same admin wallet first to approve this action.");
    }
    return buildWalletActionHeaders({
      address: currentAddress,
      publicKey: account.publicKey,
      signMessage,
      method,
      pathname,
    });
  }

  const loadData = useCallback(async () => {
    const res = await authFetch("/api/v1/admin/creator-applications");
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
      const res = await authFetch("/api/v1/admin/creator-applications");
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
    const res = await authFetch("/api/v1/admin/creator-applications", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(await buildActionHeaders("PATCH", "/api/v1/admin/creator-applications")),
      },
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
    <section className="app-panel mt-6 rounded-[2rem] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="app-kicker">Creator review queue</p>
          <h2 className="mt-2 text-2xl font-semibold">Pending creator applications</h2>
          <p className="mt-2 text-sm text-white/60">Each application can only be reviewed once. Approved creators move to the active creator list below.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <div key={item.id} className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.displayName}</p>
                <p className="mt-1 text-xs text-white/55">{item.userId}</p>
                <p className="mt-3 text-sm leading-7 text-white/75">{item.pitch}</p>
                <p className="mt-2 text-xs text-white/45">Submitted {new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void reviewApplication(item.id, "approved")}
                  className="app-success-button px-4 py-2 text-xs"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void reviewApplication(item.id, "rejected")}
                  className="app-danger-button px-4 py-2 text-xs"
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
          <p className="app-kicker">Approved list</p>
          <h3 className="mt-2 text-2xl font-semibold">Active creators</h3>
          <p className="mt-1 text-sm text-white/60">Wallets that already have creator access.</p>
        </div>
        <div className="mt-4 space-y-2">
          {creators.length > 0 ? creators.map((creator) => (
            <div key={creator.userId} className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
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
