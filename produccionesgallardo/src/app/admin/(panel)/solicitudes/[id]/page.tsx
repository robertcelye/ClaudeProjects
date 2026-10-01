import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, CATEGORIES, EVENT_TYPES, LOCATION_TYPES, type Category } from "@/lib/constants";
import { addHours, fmtDateTime, fmtMoney, toLocalInput } from "@/lib/dates";
import { checkAvailability, operationalStock, reservedUnits } from "@/lib/availability";
import { blockFor, loadAssets, loadReservations } from "@/lib/inventory";
import { waLink } from "@/lib/phone";
import { PageHeader, StatusBadge } from "@/components/admin";
import { Appointments, Conversation, DetailsForm, NoteForm, QuoteBuilder, StatusControl } from "./Panels";

/** Próxima hora en punto, mañana. */
function suggestedStart() {
  return toLocalInput(addHours(new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000), 24));
}

export default async function SolicitudPage({ params }: PageProps<"/admin/solicitudes/[id]">) {
  const user = await requireUser("solicitudes");
  const { id } = await params;
  const r = await prisma.request.findUnique({
    where: { id },
    include: {
      client: { include: { requests: { where: { NOT: { id } }, orderBy: { eventDate: "desc" } } } },
      items: { include: { asset: true } },
      quoteItems: true,
      appointments: { orderBy: { start: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!r) notFound();

  const [block, assets, cantons] = await Promise.all([blockFor(r), loadAssets(), prisma.transferRule.findMany({ select: { canton: true }, orderBy: { canton: "asc" } })]);
  const reservations = await loadReservations({ from: block.start, to: block.end });
  const availability = checkAvailability(
    r.items.map((i) => ({ assetId: i.assetId, quantity: i.quantity })),
    assets,
    block,
    reservations,
    r.id,
  );
  const quoteAssets = assets.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    unit: a.unit,
    dailyRate: a.dailyRate,
    available: Math.max(0, operationalStock(a) - reservedUnits(a.id, block.start, block.end, reservations, r.id)),
  }));
  const initialQuote = r.quoteItems.length
    ? r.quoteItems.map((q) => ({ assetId: q.assetId, quantity: q.quantity, unitPrice: q.unitPrice, days: q.days }))
    : r.items.map((i) => ({ assetId: i.assetId, quantity: i.quantity, unitPrice: i.asset.dailyRate, days: 1 }));
  const pastEvents = r.client.requests;
  const canCrm = can(user.role, "crm");

  return (
    <>
      <PageHeader title={r.client.name} subtitle={`Ticket ${r.ticket} · recibido ${fmtDateTime(r.createdAt)}`}>
        <Link href="/admin/crm" className="btn-ghost">← Pipeline</Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[2fr_3fr]">
        <div className="space-y-6">
          {/* Ficha del prospecto */}
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-bold">Ficha del prospecto</h2>
              {canCrm ? <StatusControl id={r.id} status={r.status} /> : <StatusBadge status={r.status} />}
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">WhatsApp</dt>
              <dd><a className="font-semibold text-emerald-700 hover:underline" href={waLink(r.client.whatsapp)} target="_blank" rel="noreferrer">{r.client.whatsapp} ↗</a></dd>
              <dt className="text-slate-500">Correo</dt>
              <dd><a className="hover:underline" href={`mailto:${r.client.email}`}>{r.client.email}</a></dd>
              <dt className="text-slate-500">Cliente</dt>
              <dd>{pastEvents.length ? <span className="chip bg-emerald-100 text-emerald-800">Recurrente · {pastEvents.length} solicitudes previas</span> : "Nuevo"}</dd>
            </dl>
            {pastEvents.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs">
                {pastEvents.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/solicitudes/${p.id}`} className="hover:underline">
                      {fmtDateTime(p.eventDate)} · {EVENT_TYPES[p.eventType as keyof typeof EVENT_TYPES]} · {p.canton}
                    </Link>{" "}
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Datos del evento */}
          <section className="card p-5">
            <h2 className="font-bold">Evento</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Tipo</dt><dd>{EVENT_TYPES[r.eventType as keyof typeof EVENT_TYPES]}</dd>
              <dt className="text-slate-500">Ubicación</dt><dd>{r.canton}, {r.province} <span className="text-slate-400">({LOCATION_TYPES[r.locationType as keyof typeof LOCATION_TYPES]})</span></dd>
              <dt className="text-slate-500">Montaje</dt><dd>{fmtDateTime(r.setupDate)}</dd>
              <dt className="text-slate-500">Evento</dt><dd>{fmtDateTime(r.eventDate)}{r.eventEndDate && ` → ${fmtDateTime(r.eventEndDate)}`}</dd>
              {r.audience && (<><dt className="text-slate-500">Aforo</dt><dd>{r.audience.toLocaleString("es-EC")} personas</dd></>)}
              <dt className="text-slate-500">Bloqueo logístico</dt>
              <dd>
                {fmtDateTime(block.start)} → {fmtDateTime(block.end)}
                <span className="block text-xs text-slate-500">
                  Incluye {block.transferHours} h de traslado (ida y vuelta) y desmontaje. {r.blockStart ? "✔ Inventario bloqueado" : "Se bloqueará al confirmar."}
                </span>
              </dd>
            </dl>
            {r.description && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700">“{r.description}”</p>}
            {canCrm && (
              <div className="mt-3">
                <DetailsForm
                  id={r.id}
                  cantons={cantons.map((c) => c.canton)}
                  values={{
                    setupDate: toLocalInput(r.setupDate),
                    eventDate: toLocalInput(r.eventDate),
                    eventEndDate: r.eventEndDate ? toLocalInput(r.eventEndDate) : toLocalInput(addHours(r.eventDate, 6)),
                    locationType: r.locationType,
                    canton: r.canton,
                    province: r.province,
                    audience: r.audience ? String(r.audience) : "",
                  }}
                />
              </div>
            )}
          </section>

          {/* Desglose técnico vs disponibilidad */}
          <section className="card p-5">
            <h2 className="font-bold">Desglose técnico solicitado vs. bodega</h2>
            <p className="text-xs text-slate-500">Disponibilidad real calculada para el bloqueo logístico de esta fecha.</p>
            <div className="overflow-x-auto"><table className="mt-3 w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                  <th className="py-2 pr-2">Equipo</th><th className="px-2 py-2 text-right">Pide</th><th className="px-2 py-2 text-right" title="Stock operativo">Oper.</th><th className="px-2 py-2 text-right" title="Reservado por otros eventos">Reserv.</th><th className="py-2 pl-2 text-right">Disp.</th>
                </tr>
              </thead>
              <tbody>
                {availability.map((l) => (
                  <tr key={l.assetId} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{l.name}</td>
                    <td className="py-2 text-right font-semibold">{l.requested}</td>
                    <td className="py-2 text-right">{l.operational}</td>
                    <td className="py-2 text-right">{l.reserved}</td>
                    <td className={`py-2 text-right font-bold ${l.ok ? "text-emerald-700" : "text-red-600"}`}>{l.available} {l.ok ? "✔" : "✖"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {r.items.some((i) => i.note) && (
              <ul className="mt-2 text-xs text-slate-500">{r.items.filter((i) => i.note).map((i) => <li key={i.id}>{i.asset.name}: {i.note}</li>)}</ul>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Categorías: {[...new Set(r.items.map((i) => CATEGORIES[i.asset.category as Category]?.short))].join(", ") || "—"}
            </p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Citas</h2>
            {canCrm ? (
              <Appointments
                id={r.id}
                suggested={suggestedStart()}
                items={r.appointments.map((a) => ({ id: a.id, when: fmtDateTime(a.start), mode: a.mode, status: a.status, location: a.location, notes: a.notes }))}
              />
            ) : (
              <ul className="text-sm">{r.appointments.map((a) => <li key={a.id}>{fmtDateTime(a.start)} · {a.mode}</li>)}</ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Transcripción / log de IA (WhatsApp)</h2>
            <Conversation
              id={r.id}
              aiActive={r.aiActive}
              waHref={waLink(r.client.whatsapp)}
              canSimulate={can(user.role, "configuracion")}
              messages={r.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, at: fmtDateTime(m.createdAt), delivered: m.delivered }))}
            />
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-bold">Generador de presupuesto rápido</h2>
              {r.quoteTotal != null && <span className="text-sm text-slate-500">Guardado: <strong>{fmtMoney(r.quoteTotal)}</strong> + IVA</span>}
            </div>
            <QuoteBuilder id={r.id} assets={quoteAssets} initial={initialQuote} notes={r.quoteNotes} canEdit={can(user.role, "presupuesto")} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Historial</h2>
            <NoteForm id={r.id} />
            <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4">
              {r.activities.map((a) => (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <p className="text-slate-700">{a.message}</p>
                  <p className="text-xs text-slate-400">{a.actor} · {fmtDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
