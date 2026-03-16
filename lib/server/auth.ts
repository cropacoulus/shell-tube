import { headers } from "next/headers";

import { normalizeUserRole } from "@/lib/auth/capabilities";
import type { AuthContext } from "@/lib/auth/types";

function fromHeaderMap(headerMap: Headers): AuthContext | null {
  const userId = headerMap.get("x-user-id");
  const profileId = headerMap.get("x-profile-id");
  const region = headerMap.get("x-region");
  const sessionId = headerMap.get("x-session-id");
  const role = normalizeUserRole(headerMap.get("x-role"));

  if (!userId || !profileId || !region || !sessionId) return null;
  return { userId, profileId, region, sessionId, role };
}

export async function getAuthContextFromHeaders(): Promise<AuthContext | null> {
  return fromHeaderMap(await headers());
}

export function getAuthContextFromRequest(req: Request): AuthContext | null {
  return fromHeaderMap(req.headers);
}
