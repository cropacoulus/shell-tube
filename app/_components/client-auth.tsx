"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { authFetch } from "@/lib/client/auth-fetch";

export type AuthenticatedProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: "student" | "creator" | "admin";
  updatedAt?: string;
};

type AuthState = {
  loading: boolean;
  profile: AuthenticatedProfile | null;
  unauthorized: boolean;
  error: string | null;
};

export function useAuthenticatedProfile() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    profile: null,
    unauthorized: false,
    error: null,
  });

  useEffect(() => {
    let active = true;

    void (async () => {
      const response = await authFetch("/api/v1/profile").catch(() => null);
      if (!active) return;
      if (!response) {
        setState({
          loading: false,
          profile: null,
          unauthorized: false,
          error: "Unable to reach the profile endpoint.",
        });
        return;
      }

      if (response.status === 401) {
        setState({
          loading: false,
          profile: null,
          unauthorized: true,
          error: null,
        });
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setState({
          loading: false,
          profile: null,
          unauthorized: false,
          error: body?.error?.message || "Failed to load wallet profile.",
        });
        return;
      }

      const body = (await response.json()) as { data: AuthenticatedProfile };
      setState({
        loading: false,
        profile: body.data,
        unauthorized: false,
        error: null,
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function ClientAuthGate({
  children,
  allow,
  fallbackTitle = "Wallet sign-in required",
  fallbackCopy = "Connect your wallet and sign in to continue.",
  deniedTitle = "Access restricted",
  deniedCopy = "This wallet does not have permission to open this surface.",
}: {
  children: (profile: AuthenticatedProfile) => ReactNode;
  allow?: (profile: AuthenticatedProfile) => boolean;
  fallbackTitle?: string;
  fallbackCopy?: string;
  deniedTitle?: string;
  deniedCopy?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, profile, unauthorized, error } = useAuthenticatedProfile();

  useEffect(() => {
    if (!unauthorized) return;
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/signin${next}`);
  }, [pathname, router, unauthorized]);

  if (loading) {
    return (
      <section className="app-panel rounded-[2rem] p-8">
        <p className="app-kicker">Loading wallet session</p>
        <h1 className="mt-3 text-3xl font-semibold">Checking wallet access…</h1>
      </section>
    );
  }

  if (error) {
    return (
      <section className="app-panel rounded-[2rem] p-8">
        <p className="app-kicker">Session error</p>
        <h1 className="mt-3 text-3xl font-semibold">{fallbackTitle}</h1>
        <p className="mt-3 text-white/70">{error}</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="app-panel rounded-[2rem] p-8">
        <p className="app-kicker">Wallet sign-in required</p>
        <h1 className="mt-3 text-3xl font-semibold">{fallbackTitle}</h1>
        <p className="mt-3 text-white/70">{fallbackCopy}</p>
      </section>
    );
  }

  if (allow && !allow(profile)) {
    return (
      <section className="app-panel rounded-[2rem] p-8">
        <p className="app-kicker">Restricted surface</p>
        <h1 className="mt-3 text-3xl font-semibold">{deniedTitle}</h1>
        <p className="mt-3 text-white/70">{deniedCopy}</p>
      </section>
    );
  }

  return <>{children(profile)}</>;
}
