import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Permission, type Role } from "./constants";

export const SESSION_COOKIE = "pg_session";
const MAX_AGE = 60 * 60 * 12; // 12 h

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function verifyToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: payload.sub!, name: String(payload.name), email: String(payload.email), role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  return verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Exige sesión (y opcionalmente un permiso). Redirige al login o al tablero. */
export async function requireUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/admin/login");
  if (permission && !can(user.role, permission)) redirect("/admin?denegado=1");
  return user;
}
