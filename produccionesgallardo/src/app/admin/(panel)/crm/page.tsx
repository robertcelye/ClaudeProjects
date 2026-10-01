import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EVENT_TYPES } from "@/lib/constants";
import { addDays, fmtDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/admin";
import { Kanban, type Card } from "./Kanban";

export default async function CrmPage() {
  await requireUser("crm");
  const now = new Date();
  const rows = await prisma.request.findMany({
    where: { OR: [{ status: { notIn: ["FINALIZADO", "CANCELADO"] } }, { updatedAt: { gte: addDays(now, -60) } }] },
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      _count: { select: { items: true } },
      appointments: { where: { status: "PROGRAMADA", start: { gte: now } }, orderBy: { start: "asc" }, take: 1 },
    },
  });
  const cards: Card[] = rows.map((r) => ({
    id: r.id,
    ticket: r.ticket,
    client: r.client.name,
    eventType: EVENT_TYPES[r.eventType as keyof typeof EVENT_TYPES] ?? r.eventType,
    eventDate: fmtDateTime(r.eventDate),
    canton: r.canton,
    status: r.status,
    quoteTotal: r.quoteTotal,
    aiActive: r.aiActive,
    nextAppointment: r.appointments[0] ? fmtDateTime(r.appointments[0].start) : null,
    itemsCount: r._count.items,
  }));
  return (
    <>
      <PageHeader title="CRM de solicitudes" subtitle="Pipeline comercial: mueve cada solicitud según su avance." />
      <Kanban initial={cards} />
    </>
  );
}
