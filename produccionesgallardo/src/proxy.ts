import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Verificación optimista: sin sesión válida, /admin redirige al login.
// La autorización por rol se valida de nuevo en cada página y server action.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("pg_session")?.value;
  let valid = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valid = true;
    } catch {}
  }
  const isLogin = request.nextUrl.pathname === "/admin/login";
  if (!valid && !isLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (valid && isLogin) return NextResponse.redirect(new URL("/admin", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
