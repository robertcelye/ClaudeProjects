import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/phone";

export default async function ConfirmacionPage({ params }: PageProps<"/cotizar/confirmacion/[ticket]">) {
  const { ticket } = await params;
  const [r, s] = await Promise.all([
    prisma.request.findUnique({ where: { ticket }, include: { client: true, items: { include: { asset: true } } } }),
    getSettings(),
  ]);
  if (!r) notFound();
  const first = r.client.name.split(" ")[0];
  const wa = waLink(s.businessWhatsapp, `Hola, soy ${r.client.name}. Acabo de enviar la solicitud ${r.ticket} desde la web y quisiera coordinar la reunión.`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">✅</div>
        <h1 className="mt-4 text-3xl font-black">¡Gracias, {first}! Recibimos tu solicitud</h1>
        <p className="mt-2 text-white/60">Guarda tu número de ticket para cualquier consulta.</p>
        <p className="mt-6 inline-block rounded-xl border border-gold-500/50 bg-gold-500/10 px-6 py-3 font-mono text-2xl font-bold tracking-widest text-gold-300">{r.ticket}</p>
      </div>

      <div className="mt-10 flex gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <span className="relative mt-1 flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
        <p className="text-emerald-100">
          <strong>Nuestro asistente virtual te ha enviado un mensaje a tu WhatsApp</strong> ({r.client.whatsapp}) para coordinar los horarios disponibles de la reunión.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-ink-800 p-6">
        <h2 className="font-bold">Resumen del ticket</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-white/50">Tipo de evento</dt><dd>{EVENT_TYPES[r.eventType as keyof typeof EVENT_TYPES]}</dd></div>
          <div><dt className="text-white/50">Ubicación</dt><dd>{r.canton}, {r.province}</dd></div>
          <div><dt className="text-white/50">Montaje</dt><dd>{fmtDateTime(r.setupDate)}</dd></div>
          <div><dt className="text-white/50">Inicio del evento</dt><dd>{fmtDateTime(r.eventDate)}</dd></div>
          {r.audience && <div><dt className="text-white/50">Aforo</dt><dd>{r.audience.toLocaleString("es-EC")} personas</dd></div>}
          <div className="sm:col-span-2">
            <dt className="text-white/50">Equipamiento</dt>
            <dd>
              <ul className="mt-1 space-y-1">
                {r.items.map((i) => (
                  <li key={i.id}>• {i.asset.name} — {i.quantity} {i.asset.unit}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-white/60">¿Prefieres escribirnos primero?</p>
        <a href={wa} target="_blank" rel="noreferrer" className="btn bg-[#25D366] px-6 py-3 text-base text-white hover:bg-[#1fb957]">
          Escribir por WhatsApp
        </a>
        <Link href="/" className="mt-4 text-sm text-white/50 hover:text-white">Volver al inicio</Link>
      </div>
    </div>
  );
}
