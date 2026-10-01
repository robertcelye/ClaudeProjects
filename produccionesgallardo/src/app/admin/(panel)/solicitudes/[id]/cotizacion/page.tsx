import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EVENT_TYPES } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";

export default async function CotizacionPrint({ params }: PageProps<"/admin/solicitudes/[id]/cotizacion">) {
  await requireUser("presupuesto");
  const { id } = await params;
  const [r, s] = await Promise.all([
    prisma.request.findUnique({ where: { id }, include: { client: true, quoteItems: { include: { asset: true } } } }),
    getSettings(),
  ]);
  if (!r) notFound();
  const subtotal = r.quoteItems.reduce((t, i) => t + i.quantity * i.unitPrice * i.days, 0);
  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-slate-900 shadow print:p-0 print:shadow-none">
      <div className="flex items-start justify-between border-b-4 border-amber-400 pb-4">
        <div>
          <p className="text-2xl font-black">{s.companyName.toUpperCase()}</p>
          <p className="text-xs text-slate-500">Machala, El Oro · {s.businessWhatsapp} · {s.contactEmail}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold tracking-widest text-amber-700 uppercase">Cotización</p>
          <p className="font-mono font-bold">{r.ticket}</p>
          <p className="text-xs text-slate-500">{fmtDate(new Date())}</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-xs text-slate-500 uppercase">Cliente</p><p className="font-semibold">{r.client.name}</p><p>{r.client.email}</p><p>{r.client.whatsapp}</p></div>
        <div><p className="text-xs text-slate-500 uppercase">Evento</p><p className="font-semibold">{EVENT_TYPES[r.eventType as keyof typeof EVENT_TYPES]}</p><p>{fmtDateTime(r.eventDate)}</p><p>{r.canton}, {r.province}</p></div>
      </div>
      <table className="mt-8 w-full text-sm">
        <thead><tr className="border-b-2 border-slate-300 text-left text-xs uppercase"><th className="py-2">Descripción</th><th className="py-2 text-right">Cant.</th><th className="py-2 text-right">Días</th><th className="py-2 text-right">P. unit.</th><th className="py-2 text-right">Subtotal</th></tr></thead>
        <tbody>
          {r.quoteItems.map((i) => (
            <tr key={i.id} className="border-b border-slate-200">
              <td className="py-2">{i.asset.name}</td><td className="py-2 text-right">{i.quantity} {i.asset.unit}</td><td className="py-2 text-right">{i.days}</td><td className="py-2 text-right">{fmtMoney(i.unitPrice)}</td><td className="py-2 text-right">{fmtMoney(i.quantity * i.unitPrice * i.days)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={4} className="pt-3 text-right">Subtotal</td><td className="pt-3 text-right">{fmtMoney(subtotal)}</td></tr>
          <tr><td colSpan={4} className="text-right">IVA 15 %</td><td className="text-right">{fmtMoney(subtotal * 0.15)}</td></tr>
          <tr><td colSpan={4} className="pt-1 text-right font-bold">TOTAL</td><td className="pt-1 text-right text-lg font-black">{fmtMoney(subtotal * 1.15)}</td></tr>
        </tfoot>
      </table>
      {r.quoteNotes && <p className="mt-6 rounded bg-slate-50 p-3 text-sm whitespace-pre-line">{r.quoteNotes}</p>}
      <p className="mt-8 text-xs text-slate-500">Cotización tentativa sujeta a disponibilidad de inventario a la fecha de confirmación. El evento se confirma con el pago del anticipo.</p>
      <div className="mt-6 text-center"><PrintButton label="🖨️ Imprimir / Guardar PDF" className="btn-dark" /></div>
    </div>
  );
}
