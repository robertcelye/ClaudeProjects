// Utilidades de fecha. Toda la operación ocurre en Ecuador continental (UTC-5, sin horario de verano).
export const TZ = "America/Guayaquil";
const OFFSET = "-05:00";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Convierte "2026-11-15T08:00" (hora local Ecuador) en Date. */
export function parseLocal(value: string): Date {
  const v = value.length === 10 ? `${value}T00:00` : value;
  return new Date(`${v.length === 16 ? `${v}:00` : v}${OFFSET}`);
}

/** Date → "2026-11-15T08:00" en hora de Ecuador (para inputs datetime-local). */
export function toLocalInput(d: Date): string {
  const local = new Date(d.getTime() - 5 * HOUR);
  return local.toISOString().slice(0, 16);
}

/** Date → "2026-11-15" (día en Ecuador). */
export function dayKey(d: Date): string {
  return toLocalInput(d).slice(0, 10);
}

/** Inicio del día (00:00 Ecuador) que contiene a `d`. */
export function startOfDay(d: Date): Date {
  return parseLocal(dayKey(d));
}

export function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * HOUR);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

/** Rango semiabierto [aStart, aEnd) se solapa con [bStart, bEnd). */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Día de la semana en Ecuador (0 = domingo). */
export function weekday(d: Date): number {
  return new Date(d.getTime() - 5 * HOUR).getUTCDay();
}

export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("es-EC", { timeZone: TZ, day: "numeric", month: "long", year: "numeric", ...opts }).format(
    new Date(d),
  );
}

export function fmtDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

export function fmtTime(d: Date | string): string {
  return new Intl.DateTimeFormat("es-EC", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(d),
  );
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);
}
