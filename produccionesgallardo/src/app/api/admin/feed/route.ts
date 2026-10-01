import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { latestFeed } from "@/lib/feed";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await latestFeed());
}
