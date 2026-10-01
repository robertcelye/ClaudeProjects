// Alta de solicitudes desde el portal público y disparo del flujo automático.
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "./db";
import { EVENT_TYPES, LOCATION_TYPES } from "./constants";
import { parseLocal } from "./dates";
import { normalizeEcPhone } from "./phone";
import { agentRespond } from "./agent";
import { getSettings } from "./settings";
import { sendTemplate, whatsappConfigured } from "./whatsapp";

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha inválida");

export const leadSchema = z
  .object({
    eventType: z.enum(Object.keys(EVENT_TYPES) as [string, ...string[]]),
    setupDate: localDateTime,
    eventDate: localDateTime,
    locationType: z.enum(Object.keys(LOCATION_TYPES) as [string, ...string[]]),
    canton: z.string().trim().max(80).default(""),
    province: z.string().trim().max(80).default(""),
    audience: z.coerce.number().int().min(0).max(500_000).optional(),
    items: z
      .array(z.object({ assetId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(10_000), note: z.string().max(200).default("") }))
      .max(50)
      .default([]),
    description: z.string().trim().max(3000).default(""),
    name: z.string().trim().min(3, "Ingresa tu nombre completo").max(120),
    email: z.email("Correo inválido").max(160),
    whatsapp: z.string().transform((v, ctx) => {
      const n = normalizeEcPhone(v);
      if (!n) ctx.addIssue({ code: "custom", message: "Número de WhatsApp inválido (formato +593 9X XXX XXXX)" });
      return n ?? "";
    }),
  })
  .superRefine((d, ctx) => {
    const setup = parseLocal(d.setupDate);
    const event = parseLocal(d.eventDate);
    if (setup > event) ctx.addIssue({ code: "custom", path: ["setupDate"], message: "El montaje debe ser antes del inicio del evento" });
    if (event < new Date()) ctx.addIssue({ code: "custom", path: ["eventDate"], message: "La fecha del evento ya pasó" });
    if (d.locationType === "CANTON_EL_ORO" && !d.canton) ctx.addIssue({ code: "custom", path: ["canton"], message: "Selecciona el cantón" });
    if (d.locationType === "OTRA_PROVINCIA" && !d.province) ctx.addIssue({ code: "custom", path: ["province"], message: "Indica la provincia" });
  });

export type LeadInput = z.input<typeof leadSchema>;

/** Ticket legible: PG-AAMM-XXXX */
export function newTicket(date = new Date()): string {
  const yymm = date.toISOString().slice(2, 7).replace("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from(crypto.randomBytes(4), (b) => alphabet[b % alphabet.length]).join("");
  return `PG-${yymm}-${rand}`;
}

export async function createLead(input: z.output<typeof leadSchema>) {
  const canton = input.locationType === "MACHALA" ? "Machala" : input.locationType === "CANTON_EL_ORO" ? input.canton : input.canton || input.province;
  const province = input.locationType === "OTRA_PROVINCIA" ? input.province : "El Oro";

  const assets = await prisma.asset.findMany({ where: { id: { in: input.items.map((i) => i.assetId) }, active: true, publicVisible: true }, select: { id: true } });
  const validIds = new Set(assets.map((a) => a.id));

  const client = await prisma.client.upsert({
    where: { whatsapp: input.whatsapp },
    create: { name: input.name, email: input.email, whatsapp: input.whatsapp },
    update: { name: input.name, email: input.email },
  });

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.request.create({
        data: {
          ticket: newTicket(),
          clientId: client.id,
          eventType: input.eventType,
          setupDate: parseLocal(input.setupDate),
          eventDate: parseLocal(input.eventDate),
          locationType: input.locationType,
          canton,
          province,
          audience: input.audience || null,
          description: input.description,
          items: { create: input.items.filter((i) => validIds.has(i.assetId)).map((i) => ({ assetId: i.assetId, quantity: i.quantity, note: i.note })) },
          activities: { create: { type: "WEBHOOK", message: "Requerimiento recibido desde la web" } },
        },
        include: { client: true },
      });
    } catch (e) {
      // Colisión de ticket (muy improbable): reintentar
      if (attempt < 3 && String(e).includes("Unique constraint")) continue;
      throw e;
    }
  }
}

/**
 * Flujo posterior al alta (se ejecuta tras responder al cliente):
 * 1. Webhook externo opcional (n8n / Make / Zapier).
 * 2. Plantilla de WhatsApp de apertura (si está configurada) y primer mensaje del agente IA.
 */
export async function processNewLead(requestId: string) {
  const settings = await getSettings();
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { client: true, items: { include: { asset: true } } } });
  if (!r) return;

  if (settings.leadWebhookUrl) {
    try {
      const res = await fetch(settings.leadWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "lead.created", request: r }),
      });
      await prisma.activity.create({ data: { requestId, type: "WEBHOOK", message: `Webhook externo disparado (${res.status})` } });
    } catch (e) {
      await prisma.activity.create({ data: { requestId, type: "WEBHOOK", message: `Webhook externo falló: ${String(e).slice(0, 200)}` } });
    }
  }

  if (whatsappConfigured() && process.env.WHATSAPP_TEMPLATE_NAME) {
    const t = await sendTemplate(r.client.whatsapp, [r.client.name.split(" ")[0], r.ticket]);
    await prisma.activity.create({
      data: { requestId, type: "NOTE", actor: "WhatsApp", message: t.delivered ? "Plantilla de bienvenida enviada" : `Plantilla no enviada: ${t.error ?? ""}` },
    });
  }

  await agentRespond(requestId, true);
}
