import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { occupancyPercent, stockAlerts } from "@/lib/availability";
import { addDays, dayKey, fmtDate, fmtDateTime, parseLocal, weekday } from "@/lib/dates";
import { loadAssets, loadReservations } from "@/lib/inventory";
import { latestFeed } from "@/lib/feed";
import { PageHeader, StatusBadge } from "@/components/admin";
import { LiveFeed } from "./LiveFeed";

/** Viernes 00:00 → lunes 00:00 del fin de semana en curso o el próximo. */
function weekendRange(now: Date) {
  const today = parseLocal(dayKey(now));
  const wd = weekday(today); // 0 dom … 6 sáb
  const toFriday = wd === 0 ? -2 : wd === 6 ? -1 : 5 - wd;
  const fri = addDays(today, toFriday);
  return { from: fri, to: addDays(fri, 3) };
}

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireUser("dashboard");
  const { denegado } = await searchParams;
  const now = new Date();
  const monthStart = parseLocal(`${dayKey(now).slice(0, 7)}-01`);
  const weekend = weekendRange(now);
  const horizon = 90;

  const [newLeads, pendingAppts, weekendEvents, assets, reservations, feed, unattended] = await Promise.all([
    prisma.request.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.appointment.findMany({
      where: { status: "PROGRAMADA", end: { gte: now } },
      orderBy: { start: "asc" },
      include: { request: { include: { client: true } } },
      take: 6,
    }),
    prisma.request.findMany({
      where: { status: "CONFIRMADO", eventDate: { gte: weekend.from, lt: weekend.to } },
      include: { client: true },
      orderBy: { eventDate: "asc" },
    }),
    loadAssets(),
    loadReservations({ from: now, to: addDays(now, horizon) }),
    latestFeed(),
    prisma.request.findMany({ where: { status: "NUEVO" }, include: { client: true }, orderBy: { createdAt: "asc" }, take: 5 }),
  ]);
  const pendingCount = await prisma.appointment.count({ where: { status: "PROGRAMADA", end: { gte: now } } });
  const occupancy = occupancyPercent(assets, reservations, now, 30);
  const alerts = stockAlerts(assets, reservations, now, horizon);

  const kpis = [
    { label: "Leads nuevos del mes", value: newLeads, href: "/admin/crm", accent: "text-sky-600" },
    { label: "Citas pendientes de atención", value: pendingCount, href: "/admin/calendario", accent: "text-blue-600" },
    { label: "Eventos confirmados este fin de semana", value: weekendEvents.length, href: "/admin/calendario", accent: "text-emerald-600" },
    { label: "Ocupación de inventario (30 días)", value: `${occupancy}%`, href: "/admin/inventario", accent: "text-amber-600" },
  ];

  return (
    <>
      <PageHeader title={`Hola, ${user.name.split(" ")[0]}`} subtitle={`Estado operativo y comercial · ${fmtDate(now, { weekday: "long" })}`}>
        <Link href="/admin/crm" className="btn-dark">Ir al pipeline</Link>
      </PageHeader>
      {denegado && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">No tienes permiso para acceder a esa sección.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card p-5 transition hover:shadow-md">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{k.label}</p>
            <p className={`mt-2 text-4xl font-black ${k.accent}`}>{k.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className="card">
            <h2 className="border-b border-slate-100 px-5 py-3 font-bold">⚠️ Alertas rápidas de stock</h2>
            {alerts.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Sin alertas: todo el inventario tiene margen en los próximos {horizon} días.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alerts.slice(0, 8).map((a) => (
                  <li key={`${a.assetId}-${a.from}`} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <span className={`mt-0.5 chip ${a.level === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{a.peakPercent}%</span>
                    <span>
                      <strong>{a.assetName}</strong> al {a.peakPercent >= 100 ? "100% de capacidad reservada" : `${a.peakPercent}% de capacidad`}{" "}
                      {a.from === a.to ? `para el ${fmtDate(parseLocal(a.from), { year: undefined })}` : `del ${fmtDate(parseLocal(a.from), { year: undefined })} al ${fmtDate(parseLocal(a.to), { year: undefined })}`}
                      {a.peakPercent > 100 && <span className="ml-1 font-semibold text-red-600">(sobre-reservado)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="card">
              <h2 className="border-b border-slate-100 px-5 py-3 font-bold">Próximas citas</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {pendingAppts.length === 0 && <li className="p-5 text-slate-500">Sin citas pendientes.</li>}
                {pendingAppts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/solicitudes/${a.requestId}`} className="block px-5 py-3 hover:bg-slate-50">
                      <p className="font-semibold">{a.request.client.name}</p>
                      <p className="text-slate-500">{fmtDateTime(a.start)} · {a.mode === "VIRTUAL" ? "Virtual" : "Presencial"}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card">
              <h2 className="border-b border-slate-100 px-5 py-3 font-bold">Fin de semana</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {weekendEvents.length === 0 && <li className="p-5 text-slate-500">Sin eventos confirmados.</li>}
                {weekendEvents.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/solicitudes/${r.id}`} className="block px-5 py-3 hover:bg-slate-50">
                      <p className="font-semibold">{r.client.name}</p>
                      <p className="text-slate-500">{fmtDateTime(r.eventDate)} · {r.canton}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {unattended.length > 0 && (
            <section className="card">
              <h2 className="border-b border-slate-100 px-5 py-3 font-bold">Leads sin primer contacto</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {unattended.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/solicitudes/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <StatusBadge status={r.status} />
                      <span className="font-semibold">{r.client.name}</span>
                      <span className="ml-auto text-slate-400">{fmtDateTime(r.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="card self-start">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Feed en tiempo real · Agente IA
          </h2>
          <LiveFeed initial={feed} />
        </section>
      </div>
    </>
  );
}
