import { NextResponse, type NextRequest } from "next/server";

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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
