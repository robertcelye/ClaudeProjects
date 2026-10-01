import { describe, expect, it } from "vitest";
import { checkAvailability, computeBlock, occupancyPercent, reservedUnits, stockAlerts, type Reservation } from "@/lib/availability";
import { parseLocal } from "@/lib/dates";

const led = { id: "led", name: "Pantalla LED P3.9", totalStock: 40, maintenanceUnits: 2 };
const band = { id: "band", name: "Banda completa", totalStock: 1, maintenanceUnits: 0 };

const res = (id: string, start: string, end: string, items: [string, number][]): Reservation => ({
  requestId: id,
  start: parseLocal(start),
  end: parseLocal(end),
  items: items.map(([assetId, quantity]) => ({ assetId, quantity })),
});

describe("computeBlock", () => {
  it("añade traslado antes y después, y desmontaje tras el evento", () => {
    const b = computeBlock({
      setupDate: parseLocal("2026-11-15T08:00"),
      eventDate: parseLocal("2026-11-15T18:00"),
      eventEndDate: parseLocal("2026-11-15T23:00"),
      transferHours: 12, // Piñas / Zaruma
      teardownHours: 6,
    });
    expect(b.start).toEqual(parseLocal("2026-11-14T20:00"));
    expect(b.teardownEnd).toEqual(parseLocal("2026-11-16T05:00"));
    expect(b.end).toEqual(parseLocal("2026-11-16T17:00"));
  });

  it("asume 6 h de evento si no hay hora de fin", () => {
    const b = computeBlock({ setupDate: parseLocal("2026-11-15T08:00"), eventDate: parseLocal("2026-11-15T18:00"), transferHours: 0, teardownHours: 0 });
    expect(b.eventEnd).toEqual(parseLocal("2026-11-16T00:00"));
  });
});

describe("disponibilidad", () => {
  const reservations = [
    res("r1", "2026-11-14T20:00", "2026-11-16T05:00", [["led", 30]]),
    res("r2", "2026-11-20T08:00", "2026-11-21T02:00", [["led", 10], ["band", 1]]),
  ];

  it("suma solo reservas que se solapan", () => {
    expect(reservedUnits("led", parseLocal("2026-11-15T00:00"), parseLocal("2026-11-16T00:00"), reservations)).toBe(30);
    expect(reservedUnits("led", parseLocal("2026-11-17T00:00"), parseLocal("2026-11-18T00:00"), reservations)).toBe(0);
  });

  it("rangos contiguos no se solapan (semiabiertos)", () => {
    expect(reservedUnits("led", parseLocal("2026-11-16T05:00"), parseLocal("2026-11-16T10:00"), reservations)).toBe(0);
  });

  it("descuenta mantenimiento y marca faltantes", () => {
    const lines = checkAvailability(
      [{ assetId: "led", quantity: 10 }],
      [led],
      { start: parseLocal("2026-11-15T10:00"), end: parseLocal("2026-11-15T20:00") },
      reservations,
    );
    expect(lines[0]).toMatchObject({ operational: 38, reserved: 30, available: 8, ok: false });
  });

  it("excluye la propia solicitud al recalcular", () => {
    const lines = checkAvailability([{ assetId: "band", quantity: 1 }], [band], { start: parseLocal("2026-11-20T10:00"), end: parseLocal("2026-11-20T12:00") }, reservations, "r2");
    expect(lines[0].ok).toBe(true);
  });
});

describe("alertas y ocupación", () => {
  it("genera alerta crítica al 100 % y la agrupa por días consecutivos", () => {
    const reservations = [res("r1", "2026-11-14T20:00", "2026-11-16T05:00", [["led", 38]])];
    const alerts = stockAlerts([led], reservations, parseLocal("2026-11-13T09:00"), 5);
    expect(alerts).toEqual([{ assetId: "led", assetName: "Pantalla LED P3.9", from: "2026-11-14", to: "2026-11-16", peakPercent: 100, level: "critical" }]);
  });

  it("advierte desde el 80 %", () => {
    const reservations = [res("r1", "2026-11-14T08:00", "2026-11-14T20:00", [["led", 31]])];
    expect(stockAlerts([led], reservations, parseLocal("2026-11-14T00:00"), 1)[0].level).toBe("warning");
  });

  it("calcula la ocupación media", () => {
    const reservations = [res("r1", "2026-11-14T00:00", "2026-11-15T00:00", [["band", 1]])];
    expect(occupancyPercent([band], reservations, parseLocal("2026-11-14T00:00"), 2)).toBe(50);
  });
});
