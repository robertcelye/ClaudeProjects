// Generación de horarios disponibles para reuniones técnicas/comerciales.
import { addDays, addHours, dayKey, overlaps, parseLocal, weekday } from "./dates";

export interface Slot {
  start: Date;
  end: Date;
}

/**
 * Horarios libres de lunes a sábado dentro de la franja laboral, a partir de mañana.
 * Se devuelven como máximo `perDay` horarios por día, repartidos en la jornada.
 */
export function freeSlots(opts: {
  now: Date;
  days: number;
  hours: string; // "09:00-18:00"
  durationMinutes: number;
  busy: Slot[];
  perDay?: number;
}): Slot[] {
  const [open, close] = opts.hours.split("-").map((s) => s.trim());
  const dur = opts.durationMinutes / 60;
  const out: Slot[] = [];
  let day = parseLocal(dayKey(addDays(opts.now, 1)));
  let counted = 0;
  while (counted < opts.days) {
    if (weekday(day) !== 0) {
      counted++;
      const key = dayKey(day);
      const dayOpen = parseLocal(`${key}T${open}`);
      const dayClose = parseLocal(`${key}T${close}`);
      const candidates: Slot[] = [];
      for (let s = dayOpen; addHours(s, dur) <= dayClose; s = addHours(s, 1)) {
        const e = addHours(s, dur);
        if (!opts.busy.some((b) => overlaps(s, e, b.start, b.end))) candidates.push({ start: s, end: e });
      }
      const n = opts.perDay ?? candidates.length;
      if (candidates.length <= n) out.push(...candidates);
      else for (let i = 0; i < n; i++) out.push(candidates[Math.floor((i * (candidates.length - 1)) / Math.max(1, n - 1))]);
    }
    day = addDays(day, 1);
  }
  return out;
}
