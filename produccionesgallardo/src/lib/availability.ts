// Validador de disponibilidad de inventario (núcleo puro, sin acceso a BD).
import { addDays, addHours, dayKey, overlaps, parseLocal } from "./dates";

export const DEFAULT_EVENT_HOURS = 6;

export interface BlockInput {
  setupDate: Date;
  eventDate: Date;
  eventEndDate?: Date | null;
  /** Horas extra por traslado (reglas de traslado, Vista 9). Se aplican antes y después. */
  transferHours: number;
  /** Horas de desmontaje tras el evento. */
  teardownHours: number;
}

export interface Block {
  start: Date;
  setupStart: Date;
  eventStart: Date;
  eventEnd: Date;
  teardownEnd: Date;
  end: Date;
}

/** Calcula el bloqueo logístico completo: traslado → montaje → evento → desmontaje → traslado. */
export function computeBlock(i: BlockInput): Block {
  const eventEnd = i.eventEndDate ?? addHours(i.eventDate, DEFAULT_EVENT_HOURS);
  const teardownEnd = addHours(eventEnd, i.teardownHours);
  return {
    start: addHours(i.setupDate, -i.transferHours),
    setupStart: i.setupDate,
    eventStart: i.eventDate,
    eventEnd,
    teardownEnd,
    end: addHours(teardownEnd, i.transferHours),
  };
}

export interface Reservation {
  requestId: string;
  start: Date;
  end: Date;
  items: { assetId: string; quantity: number }[];
}

export interface AssetStock {
  id: string;
  name: string;
  totalStock: number;
  maintenanceUnits: number;
}

export function operationalStock(a: Pick<AssetStock, "totalStock" | "maintenanceUnits">): number {
  return Math.max(0, a.totalStock - a.maintenanceUnits);
}

/** Unidades de un activo comprometidas en reservas que se solapan con el rango. */
export function reservedUnits(
  assetId: string,
  start: Date,
  end: Date,
  reservations: Reservation[],
  excludeRequestId?: string,
): number {
  let total = 0;
  for (const r of reservations) {
    if (r.requestId === excludeRequestId || !overlaps(start, end, r.start, r.end)) continue;
    for (const it of r.items) if (it.assetId === assetId) total += it.quantity;
  }
  return total;
}

export interface AvailabilityLine {
  assetId: string;
  name: string;
  requested: number;
  operational: number;
  reserved: number;
  available: number;
  ok: boolean;
}

/** Equipos pedidos vs. disponibilidad real en bodega para el rango del bloqueo. */
export function checkAvailability(
  requested: { assetId: string; quantity: number }[],
  assets: AssetStock[],
  block: { start: Date; end: Date },
  reservations: Reservation[],
  excludeRequestId?: string,
): AvailabilityLine[] {
  const byId = new Map(assets.map((a) => [a.id, a]));
  return requested.flatMap((r) => {
    const a = byId.get(r.assetId);
    if (!a) return [];
    const operational = operationalStock(a);
    const reserved = reservedUnits(a.id, block.start, block.end, reservations, excludeRequestId);
    const available = Math.max(0, operational - reserved);
    return [{ assetId: a.id, name: a.name, requested: r.quantity, operational, reserved, available, ok: r.quantity <= available }];
  });
}

export interface StockAlert {
  assetId: string;
  assetName: string;
  from: string; // día (YYYY-MM-DD)
  to: string;
  peakPercent: number;
  level: "critical" | "warning";
}

/**
 * Recorre día a día el horizonte y agrupa en rangos los días en que un activo
 * supera el umbral de ocupación (≥100 % crítico, ≥ warnAt advertencia).
 */
export function stockAlerts(
  assets: AssetStock[],
  reservations: Reservation[],
  from: Date,
  days: number,
  warnAt = 0.8,
): StockAlert[] {
  const alerts: StockAlert[] = [];
  const firstDay = parseLocal(dayKey(from));
  for (const a of assets) {
    const op = operationalStock(a);
    let current: StockAlert | null = null;
    for (let d = 0; d < days; d++) {
      const s = addDays(firstDay, d);
      const ratio = op === 0 ? 0 : reservedUnits(a.id, s, addDays(s, 1), reservations) / op;
      const level = ratio >= 1 ? "critical" : ratio >= warnAt ? "warning" : null;
      if (level && current && current.level === level) {
        current.to = dayKey(s);
        current.peakPercent = Math.max(current.peakPercent, Math.round(ratio * 100));
      } else {
        if (current) alerts.push(current);
        current = level
          ? { assetId: a.id, assetName: a.name, from: dayKey(s), to: dayKey(s), peakPercent: Math.round(ratio * 100), level }
          : null;
      }
    }
    if (current) alerts.push(current);
  }
  return alerts.sort((x, y) => (x.level === y.level ? x.from.localeCompare(y.from) : x.level === "critical" ? -1 : 1));
}

/** Ocupación media del inventario (unidades reservadas / operativas) en el horizonte. */
export function occupancyPercent(assets: AssetStock[], reservations: Reservation[], from: Date, days: number): number {
  const op = assets.reduce((s, a) => s + operationalStock(a), 0);
  if (op === 0) return 0;
  const firstDay = parseLocal(dayKey(from));
  let sum = 0;
  for (let d = 0; d < days; d++) {
    const s = addDays(firstDay, d);
    const reserved = assets.reduce((acc, a) => acc + Math.min(operationalStock(a), reservedUnits(a.id, s, addDays(s, 1), reservations)), 0);
    sum += reserved / op;
  }
  return Math.round((sum / days) * 100);
}
