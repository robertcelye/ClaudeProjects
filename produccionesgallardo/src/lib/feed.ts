import { prisma } from "./db";

export interface FeedItem {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  requestId: string;
  ticket: string;
  clientName: string;
}

/** Últimas interacciones del agente IA / clientes / asesores por WhatsApp. */
export async function latestFeed(limit = 15): Promise<FeedItem[]> {
  const rows = await prisma.aiMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { request: { select: { id: true, ticket: true, client: { select: { name: true } } } } },
  });
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    requestId: m.request.id,
    ticket: m.request.ticket,
    clientName: m.request.client.name,
  }));
}
