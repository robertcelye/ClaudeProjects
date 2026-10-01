import { describe, expect, it } from "vitest";
import { normalizeEcPhone, waLink } from "@/lib/phone";
import { dayKey, parseLocal, toLocalInput } from "@/lib/dates";
import { newTicket } from "@/lib/leads";

describe("normalizeEcPhone", () => {
  it.each([
    ["0991234567", "+593991234567"],
    ["991234567", "+593991234567"],
    ["+593 99 123 4567", "+593991234567"],
    ["593-99-123-4567", "+593991234567"],
  ])("%s → %s", (input, out) => expect(normalizeEcPhone(input)).toBe(out));

  it.each(["072345678", "12345", "+1 555 123 4567", ""])("rechaza %s", (input) => expect(normalizeEcPhone(input)).toBeNull());

  it("genera enlaces wa.me", () => {
    expect(waLink("+593991234567", "Hola PG")).toBe("https://wa.me/593991234567?text=Hola%20PG");
  });
});

describe("fechas en hora de Ecuador", () => {
  it("parseLocal / toLocalInput son inversas", () => {
    const d = parseLocal("2026-11-15T23:30");
    expect(d.toISOString()).toBe("2026-11-16T04:30:00.000Z");
    expect(toLocalInput(d)).toBe("2026-11-15T23:30");
    expect(dayKey(d)).toBe("2026-11-15");
  });
});

describe("newTicket", () => {
  it("tiene formato PG-AAMM-XXXX", () => {
    expect(newTicket(new Date("2026-11-03T12:00:00Z"))).toMatch(/^PG-2611-[A-Z2-9]{4}$/);
  });
});
