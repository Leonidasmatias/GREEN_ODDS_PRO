import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!username || !password) return new NextResponse("Admin indisponível: credenciais não configuradas.", { status: 503 });
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const [providedUser, providedPassword] = atob(authorization.slice(6)).split(":");
    if (providedUser === username && providedPassword === password) return NextResponse.next();
  }
  return new NextResponse("Autenticação necessária.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="GREEN ODDS PRO Admin", charset="UTF-8"' } });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
