import { connection } from "next/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { QuoteWizard } from "./QuoteWizard";

export const metadata: Metadata = { title: "Cotizar y agendar cita" };

export default async function CotizarPage({ searchParams }: PageProps<"/cotizar">) {
  await connection();
  const { equipo } = await searchParams;
  const [assets, rules] = await Promise.all([
    prisma.asset.findMany({
      where: { active: true, publicVisible: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, unit: true, recommendedCapacity: true },
    }),
    prisma.transferRule.findMany({ where: { covered: true, province: "El Oro", NOT: { canton: "Machala" } }, orderBy: { canton: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="text-3xl font-black sm:text-4xl">Solicitud de cita y requerimiento</h1>
      <p className="mt-2 mb-8 text-white/65">4 pasos rápidos. Al finalizar recibirás tu número de ticket y un mensaje por WhatsApp para agendar la reunión.</p>
      <QuoteWizard assets={assets} cantons={rules.map((r) => r.canton)} preselect={typeof equipo === "string" ? equipo : undefined} />
    </div>
  );
}
