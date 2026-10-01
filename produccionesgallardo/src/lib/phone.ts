/**
 * Normaliza un número de WhatsApp ecuatoriano a E.164 (+5939XXXXXXXX).
 * Acepta "0991234567", "991234567", "593991234567", "+593 99 123 4567".
 * Devuelve null si el formato no es válido.
 */
export function normalizeEcPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("593")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^9\d{8}$/.test(digits)) return null;
  return `+593${digits}`;
}

/** Enlace wa.me con mensaje pre-cargado. */
export function waLink(phone: string, text?: string): string {
  const n = phone.replace(/\D/g, "");
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
