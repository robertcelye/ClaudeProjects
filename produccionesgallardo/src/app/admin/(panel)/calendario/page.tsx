import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addDays, dayKey, toLocalInput } from "@/lib/dates";
import { DEFAULT_EVENT_HOURS } from "@/lib/availability";
import { PageHeader } from "@/components/admin";
import { Calendar, type CalEvent } from "./Calendar";

export default async function CalendarioPage() {
  await requireUser("calendario");
  const now = new Date();
  const from = addDays(now, -90);
  const to = addDays(now, 400);

  const [appointments, confirmed] = await Promise.all([
    prisma.appointment.findMany({
      where: { status: { not: "CANCELADA" }, start: { gte: from, lte: to } },
      include: { request: { include: { client: true } } },
    }),
    prisma.request.findMany({
      where: { status: { in: ["CONFIRMADO", "FINALIZADO"] }, blockStart: { not: null, lte: to }, blockEnd: { gte: from } },
      include: { client: true, items: { include: { asset: true } }, quoteItems: { include: { asset: true } } },
    }),
  ]);

  const events: CalEvent[] = [];
  for (const a of appointments) {
    events.push({
      id: `a-${a.id}`,
      title: a.request.client.name,
      subtitle: `${a.mode === "VIRTUAL" ? "Reunión virtual" : "Reunión presencial"} · ${a.request.ticket}`,
      start: toLocalInput(a.start),
      end: toLocalInput(a.end),
      kind: "cita",
      categories: [],
      detail: [a.location, a.notes, a.status === "REALIZADA" ? "✔ Realizada" : ""].filter(Boolean).join("\n"),
      href: `/admin/solicitudes/${a.requestId}`,
    });
  }
  for (const r of confirmed) {
    const items = r.quoteItems.length ? r.quoteItems : r.items;
    const categories = [...new Set(items.map((i) => i.asset.category))];
    const detail = items.map((i) => `• ${i.asset.name}: ${i.quantity} ${i.asset.unit}`).join("\n");
    const eventEnd = r.eventEndDate ?? new Date(r.eventDate.getTime() + DEFAULT_EVENT_HOURS * 3_600_000);
    const base = { categories, detail, href: `/admin/solicitudes/${r.id}`, subtitle: `${r.canton} · ${r.ticket}` };
    const segs: [CalEvent["kind"], Date, Date, string][] = [
      ["montaje", r.blockStart!, r.eventDate, `Montaje: ${r.client.name}`],
      ["evento", r.eventDate, eventEnd, r.client.name],
      ["desmontaje", eventEnd, r.blockEnd!, `Desmontaje: ${r.client.name}`],
    ];
    for (const [kind, s, e, title] of segs) {
      if (e > s) events.push({ ...base, id: `${kind}-${r.id}`, kind, title, start: toLocalInput(s), end: toLocalInput(e) });
    }
  }

  return (
    <>
      <PageHeader title="Calendario maestro" subtitle="Citas de negociación (azul) y bloqueos logísticos de eventos confirmados (rojo/naranja), incluyendo montaje, traslado y desmontaje." />
      <Calendar events={events} today={dayKey(now)} />
    </>
  );
}
