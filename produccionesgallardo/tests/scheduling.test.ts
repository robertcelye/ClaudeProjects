import { describe, expect, it } from "vitest";
import { freeSlots } from "@/lib/scheduling";
import { dayKey, parseLocal, toLocalInput, weekday } from "@/lib/dates";

describe("freeSlots", () => {
  const now = parseLocal("2026-11-13T15:00"); // viernes

  it("empieza mañana y omite domingos", () => {
    const slots = freeSlots({ now, days: 2, hours: "09:00-18:00", durationMinutes: 45, busy: [] });
    const days = [...new Set(slots.map((s) => dayKey(s.start)))];
    expect(days).toEqual(["2026-11-14", "2026-11-16"]); // sábado y lunes
    expect(slots.every((s) => weekday(s.start) !== 0)).toBe(true);
  });

  it("respeta la franja horaria y la duración", () => {
    const slots = freeSlots({ now, days: 1, hours: "09:00-12:00", durationMinutes: 45, busy: [] });
    expect(slots.map((s) => toLocalInput(s.start).slice(11))).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("excluye horarios ocupados", () => {
    const busy = [{ start: parseLocal("2026-11-14T10:00"), end: parseLocal("2026-11-14T10:45") }];
    const slots = freeSlots({ now, days: 1, hours: "09:00-12:00", durationMinutes: 45, busy });
    expect(slots.map((s) => toLocalInput(s.start).slice(11))).toEqual(["09:00", "11:00"]);
  });

  it("reparte como máximo perDay horarios en la jornada", () => {
    const slots = freeSlots({ now, days: 1, hours: "09:00-18:00", durationMinutes: 45, busy: [], perDay: 3 });
    expect(slots.map((s) => toLocalInput(s.start).slice(11))).toEqual(["09:00", "13:00", "17:00"]);
  });
});
