// Acceso a BD para el validador de disponibilidad.
import { prisma } from "./db";
import { computeBlock, type Reservation } from "./availability";
import { getSettings } from "./settings";

/** Horas extra de traslado según cantón/provincia (Reglas de Traslado). */
export async function transferHoursFor(canton: string, locationType: string): Promise<number> {
  const rule = await prisma.transferRule.findFirst({ where: { canton } });
  if (rule) return rule.extraHours;
  if (locationType === "OTRA_PROVINCIA") {
    const generic = await prisma.transferRule.findFirst({ where: { canton: "Otra provincia" } });
    return generic?.extraHours ?? 24;
  }
  return 0;
}

type BlockSource = {
  setupDate: Date;
  eventDate: Date;
  eventEndDate: Date | null;
  canton: string;
  locationType: string;
};

export async function blockFor(req: BlockSource) {
  const [transferHours, settings] = await Promise.all([transferHoursFor(req.canton, req.locationType), getSettings()]);
  return {
    transferHours,
    ...computeBlock({ ...req, transferHours, teardownHours: Number(settings.teardownHours) || 0 }),
  };
}

/**
 * Reservas activas: solicitudes CONFIRMADAS con bloqueo calculado.
 * Usan los ítems del presupuesto si existen; si no, lo solicitado en el formulario.
 */
export async function loadReservations(range?: { from: Date; to: Date }): Promise<Reservation[]> {
  const rows = await prisma.request.findMany({
    where: {
      status: "CONFIRMADO",
      blockStart: { not: null, ...(range ? { lt: range.to } : {}) },
      blockEnd: { not: null, ...(range ? { gt: range.from } : {}) },
    },
    include: { items: true, quoteItems: true },
  });
  return rows.map((r) => ({
    requestId: r.id,
    start: r.blockStart!,
    end: r.blockEnd!,
    items: (r.quoteItems.length ? r.quoteItems : r.items).map((i) => ({ assetId: i.assetId, quantity: i.quantity })),
  }));
}

export async function loadAssets() {
  return prisma.asset.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
}
