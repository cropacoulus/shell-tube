import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  const response = NextResponse.redirect(new URL("/signin", req.url), 303);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
