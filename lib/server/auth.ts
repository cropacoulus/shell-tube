import { headers } from "next/headers";

import { normalizeUserRole } from "@/lib/auth/capabilities";
import { DEFAULT_REGION } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";
import { getSessionAuthSecret } from "@/lib/auth/session-secret";
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
  const headerMap = await headers();
  const direct = fromHeaderMap(headerMap);
  if (direct) return direct;

  const authorization = headerMap.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const secret = getSessionAuthSecret();
  if (!token) return null;

  const claims = await verifySessionToken(token, secret);
  if (!claims) return null;

  return {
    userId: claims.sub,
    profileId: claims.profileId,
    region: claims.region || DEFAULT_REGION,
    sessionId: claims.sessionId,
    role: claims.role,
  };
}

export function getAuthContextFromRequest(req: Request): AuthContext | null {
  return fromHeaderMap(req.headers);
}

export async function getAuthContextFromRequestOrBearer(req: Request): Promise<AuthContext | null> {
  const direct = fromHeaderMap(req.headers);
  if (direct) return direct;

  const authorization = req.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const secret = getSessionAuthSecret();
  if (!token) return null;

  const claims = await verifySessionToken(token, secret);
  if (!claims) return null;

  return {
    userId: claims.sub,
    profileId: claims.profileId,
    region: claims.region || DEFAULT_REGION,
    sessionId: claims.sessionId,
    role: claims.role,
  };
}
