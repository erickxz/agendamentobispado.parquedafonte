import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";

const PUBLIC_PATHS = new Set(["/admin/login", "/api/admin/login"]);

/** Protege /admin/* e /api/admin/*. Os handlers verificam a sessão de novo (não confiar só aqui). */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  const ok = secret ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret) : false;
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }
  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
