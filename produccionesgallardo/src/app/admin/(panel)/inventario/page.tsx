import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/constants";
import { addDays, dayKey, parseLocal } from "@/lib/dates";
import { reservedUnits } from "@/lib/availability";
import { loadReservations } from "@/lib/inventory";
import { PageHeader } from "@/components/admin";
import { AssetTable, TransferRules } from "./InventoryClient";

export default async function InventarioPage() {
  const user = await requireUser("inventario");
  const now = new Date();
  const [assets, rules, reservations] = await Promise.all([
    prisma.asset.findMany({ orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }] }),
    prisma.transferRule.findMany({ orderBy: [{ extraHours: "asc" }, { canton: "asc" }] }),
    loadReservations({ from: now, to: addDays(now, 90) }),
  ]);
  const first = parseLocal(dayKey(now));
  const peak = (id: string) => {
    let max = 0;
    for (let d = 0; d < 90; d++) max = Math.max(max, reservedUnits(id, addDays(first, d), addDays(first, d + 1), reservations));
    return max;
  };
  const canEdit = can(user.role, "inventarioEditar");
  return (
    <>
      <PageHeader title="Inventario y activos propios" subtitle="Alimenta el validador de disponibilidad. Stock operativo = stock total − unidades en mantenimiento." />
      <div className="space-y-6">
        <AssetTable
          canEdit={canEdit}
          assets={assets.map((a) => ({
            ...a,
            imageUrl: a.imageUrl ?? "",
            specSheetUrl: a.specSheetUrl ?? "",
            peakReserved: peak(a.id),
          }))}
        />
        <TransferRules canEdit={canEdit} rules={rules} />
      </div>
    </>
  );
}
