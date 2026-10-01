import { connection } from "next/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSettings, parseBandFormats } from "@/lib/settings";
import { CatalogBrowser } from "./CatalogBrowser";

export const metadata: Metadata = { title: "Catálogo técnico y galería" };

export default async function CatalogoPage({ searchParams }: PageProps<"/catalogo">) {
  await connection();
  const { cat } = await searchParams;
  const [assets, settings] = await Promise.all([
    prisma.asset.findMany({
      where: { active: true, publicVisible: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, unit: true, description: true, specs: true, imageUrl: true, specSheetUrl: true, recommendedCapacity: true },
    }),
    getSettings(),
  ]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-14">
      <h1 className="text-4xl font-black">Catálogo técnico</h1>
      <p className="mt-2 max-w-2xl text-white/65">
        Especificaciones reales de nuestro inventario propio. Planners y clientes corporativos pueden verificar fichas técnicas sin intermediarios.
      </p>
      <div className="mt-10">
        <CatalogBrowser assets={assets} initial={typeof cat === "string" ? cat : "TODOS"} bandFormats={parseBandFormats(settings.bandFormats)} />
      </div>
    </div>
  );
}
