import { NextRequest, NextResponse } from "next/server";
import { authCookieName, verifyAuthToken } from "@/lib/auth-token";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/log",
  "/api/bridge/heartbeat",
  "/api/bridge/log",
  "/api/bridge/artifact",
  "/api/bridge/task-event",
  "/api/bridge/file-actions",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return true;
  return false;
}

export async function proxy(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();

  const payload = await verifyAuthToken(req.cookies.get(authCookieName())?.value).catch(() => null);
  if (payload) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
