import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_REGION, SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/jwt";

const PUBLIC_PATHS = new Set([
  "/signin",
  "/api/auth/logout",
  "/api/auth/wallet/challenge",
  "/api/auth/wallet/verify",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return pathname.startsWith("/_next") || pathname === "/favicon.ico";
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token =
    req.cookies.get(SESSION_COOKIE_NAME)?.value ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = process.env.AUTH_JWT_SECRET;

  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing session" } }, { status: 401 });
    }

    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/signin";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const claims = await verifySessionToken(token, secret);
  if (!claims) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid session" } }, { status: 401 });
    }

    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/signin";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", claims.sub);
  requestHeaders.set("x-profile-id", claims.profileId);
  requestHeaders.set("x-region", claims.region || DEFAULT_REGION);
  requestHeaders.set("x-session-id", claims.sessionId);
  requestHeaders.set("x-role", claims.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
