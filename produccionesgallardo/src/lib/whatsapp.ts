// Integración con WhatsApp Business Cloud API (Meta).
// Sin credenciales configuradas, los mensajes se registran en modo simulado.
import crypto from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export interface SendResult {
  delivered: boolean;
  simulated: boolean;
  error?: string;
}

async function post(body: unknown): Promise<SendResult> {
  if (!whatsappConfigured()) {
    console.info("[whatsapp:simulado]", JSON.stringify(body));
    return { delivered: false, simulated: true };
  }
  try {
    const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { delivered: false, simulated: false, error: `${res.status} ${await res.text()}` };
    return { delivered: true, simulated: false };
  } catch (e) {
    return { delivered: false, simulated: false, error: String(e) };
  }
}

const to = (phone: string) => phone.replace(/\D/g, "");

export function sendText(phone: string, text: string) {
  return post({ messaging_product: "whatsapp", to: to(phone), type: "text", text: { body: text, preview_url: true } });
}

/**
 * Plantilla aprobada por Meta para iniciar conversación (obligatoria fuera de la
 * ventana de 24 h). Parámetros del cuerpo: {{1}} nombre, {{2}} ticket.
 */
export function sendTemplate(phone: string, params: string[]) {
  const name = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!name) return Promise.resolve<SendResult>({ delivered: false, simulated: true, error: "sin plantilla" });
  return post({
    messaging_product: "whatsapp",
    to: to(phone),
    type: "template",
    template: {
      name,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
      components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
    },
  });
}

/** Verifica la firma X-Hub-Signature-256 de los webhooks de Meta. */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // sin secreto configurado (desarrollo)
  if (!signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface InboundMessage {
  from: string; // E.164 con +
  name?: string;
  text: string;
  id: string;
}

/** Extrae mensajes de texto entrantes del payload del webhook. */
export function parseInbound(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries as { changes?: { value?: Record<string, unknown> }[] }[]) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = (value.contacts as { wa_id: string; profile?: { name?: string } }[]) ?? [];
      for (const m of (value.messages as Record<string, unknown>[]) ?? []) {
        const text =
          m.type === "text"
            ? (m.text as { body: string }).body
            : m.type === "button"
              ? (m.button as { text: string }).text
              : m.type === "interactive"
                ? JSON.stringify(m.interactive)
                : `[${String(m.type)}]`;
        const from = String(m.from);
        out.push({ from: `+${from}`, text, id: String(m.id), name: contacts.find((c) => c.wa_id === from)?.profile?.name });
      }
    }
  }
  return out;
}
