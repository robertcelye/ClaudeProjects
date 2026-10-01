import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CATEGORIES, type Category } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";

export default async function FichaPage({ params }: PageProps<"/catalogo/ficha/[id]">) {
  const { id } = await params;
  const [a, s] = await Promise.all([prisma.asset.findFirst({ where: { id, active: true, publicVisible: true } }), getSettings()]);
  if (!a) notFound();
  return (
    <div className="mx-auto my-10 max-w-3xl bg-white p-10 text-slate-900 shadow-xl print:my-0 print:shadow-none">
      <div className="flex items-start justify-between border-b-4 border-amber-400 pb-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-amber-600 uppercase">Ficha técnica · {CATEGORIES[a.category as Category]?.label}</p>
          <h1 className="mt-1 text-3xl font-black">{a.name}</h1>
        </div>
        <p className="text-right text-sm font-black">{s.companyName.toUpperCase()}</p>
      </div>
      <p className="mt-6">{a.description}</p>
      <h2 className="mt-8 text-sm font-bold tracking-wider text-amber-700 uppercase">Especificaciones</h2>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {a.specs.split("·").map((sp) => (
            <tr key={sp} className="border-b border-slate-200">
              <td className="py-2">{sp.trim()}</td>
            </tr>
          ))}
          <tr className="border-b border-slate-200">
            <td className="py-2">Unidad de alquiler: {a.unit}</td>
          </tr>
        </tbody>
      </table>
      {a.recommendedCapacity && (
        <>
          <h2 className="mt-8 text-sm font-bold tracking-wider text-amber-700 uppercase">Dimensiones recomendadas según aforo</h2>
          <p className="mt-2 text-sm">{a.recommendedCapacity}</p>
        </>
      )}
      <p className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
        Equipo propio de {s.companyName} · WhatsApp {s.businessWhatsapp} · {s.contactEmail}
      </p>
      <div className="mt-6 text-center">
        <PrintButton label="⬇ Descargar / imprimir PDF" />
      </div>
    </div>
  );
}
