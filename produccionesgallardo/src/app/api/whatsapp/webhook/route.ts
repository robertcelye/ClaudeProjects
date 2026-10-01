// Webhook de WhatsApp Cloud API: verificación (GET) y mensajes entrantes (POST).
import { after, NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { agentRespond } from "@/lib/agent";
import { parseInbound, verifySignature } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("Firma inválida", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("JSON inválido", { status: 400 });
  }

  const toReply = new Set<string>();
  for (const m of parseInbound(payload)) {
    const client = await prisma.client.findUnique({ where: { whatsapp: m.from } });
    if (!client) continue; // número desconocido: no es un lead del portal
    const request = await prisma.request.findFirst({
      where: { clientId: client.id, status: { notIn: ["FINALIZADO", "CANCELADO"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!request) continue;
    await prisma.aiMessage.create({ data: { requestId: request.id, role: "CLIENT", content: m.text, delivered: true } });
    if (request.aiActive) toReply.add(request.id);
  }

  // Meta exige responder 200 rápido; el agente responde en segundo plano.
  after(async () => {
    for (const id of toReply) await agentRespond(id).catch((e) => console.error("[webhook] agente", e));
  });
  return NextResponse.json({ ok: true });
}
