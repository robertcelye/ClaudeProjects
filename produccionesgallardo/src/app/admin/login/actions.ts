"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import type { Role } from "@/lib/constants";

export async function login(_: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) return "Credenciales inválidas";
  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role as Role });
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
