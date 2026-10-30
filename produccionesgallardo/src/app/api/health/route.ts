import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Chequeo de salud para Docker / balanceadores: app viva y base de datos accesible.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "base de datos no disponible" }, { status: 503 });
  }
}
