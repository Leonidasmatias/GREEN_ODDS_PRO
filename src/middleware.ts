import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "gop_session";
const PROTECTED_PREFIXES = ["/dashboard", "/radar-green", "/odds-do-dia", "/green-ai-report", "/command-center", "/performance-center"];

function adminBasicAuth(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return null;
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!username || !password) return new NextResponse("Admin indisponivel: credenciais nao configuradas.", { status: 503 });
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const [providedUser, providedPassword] = atob(authorization.slice(6)).split(":");
    if (providedUser === username && providedPassword === password) return null;
  }
  return new NextResponse("Autenticacao necessaria.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="GREEN ODDS PRO Admin", charset="UTF-8"' } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const adminResponse = adminBasicAuth(request);
    if (adminResponse) return adminResponse;
  }

  const protectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!protectedRoute) return NextResponse.next();
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*", "/dashboard/:path*", "/radar-green/:path*", "/odds-do-dia/:path*", "/green-ai-report/:path*", "/command-center/:path*", "/performance-center/:path*"] };
