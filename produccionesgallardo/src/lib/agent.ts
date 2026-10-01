// Agente IA de calificación y agendamiento por WhatsApp (Claude API).
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { CATEGORIES, EVENT_TYPES, LOCATION_TYPES, type Category } from "./constants";
import { fmtDateTime, parseLocal, toLocalInput } from "./dates";
import { getSettings, listFromText, type Settings } from "./settings";
import { freeSlots } from "./scheduling";
import { sendText } from "./whatsapp";
import { notifyTeam } from "./notifications";

const MAX_TOOL_ROUNDS = 4;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "agendar_reunion",
    description:
      "Agenda la reunión técnica/comercial cuando el cliente ya eligió uno de los horarios disponibles listados en el contexto. Úsala solo con un horario exacto de esa lista.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        inicio: { type: "string", description: "Inicio en hora de Ecuador, formato YYYY-MM-DDTHH:MM, tomado de la lista de horarios." },
        modalidad: { type: "string", enum: ["VIRTUAL", "PRESENCIAL"] },
      },
      required: ["inicio", "modalidad"],
      additionalProperties: false,
    },
  },
  {
    name: "transferir_a_asesor",
    description:
      "Transfiere la conversación a un asesor humano. Úsala cuando el prospecto ya respondió las preguntas de calificación y tiene cita, cuando pida hablar con una persona, o ante temas que no puedes resolver (precios, descuentos, reclamos).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        calificado: { type: "boolean", description: "true si es un prospecto con intención real y datos suficientes." },
        resumen: { type: "string", description: "Resumen para el asesor: necesidades, presupuesto, restricciones, nivel de interés." },
      },
      required: ["calificado", "resumen"],
      additionalProperties: false,
    },
  },
];

type FullRequest = NonNullable<Awaited<ReturnType<typeof loadRequest>>>;

function loadRequest(requestId: string) {
  return prisma.request.findUnique({
    where: { id: requestId },
    include: { client: true, items: { include: { asset: true } }, appointments: true, messages: { orderBy: { createdAt: "asc" } } },
  });
}

async function availableSlots(settings: Settings) {
  const now = new Date();
  const busy = await prisma.appointment.findMany({
    where: { status: "PROGRAMADA", end: { gt: now } },
    select: { start: true, end: true },
  });
  return freeSlots({
    now,
    days: 5,
    hours: settings.meetingHours,
    durationMinutes: Number(settings.meetingDurationMinutes) || 45,
    busy,
    perDay: 3,
  });
}

export function requestSummary(r: FullRequest): string {
  const items = r.items.length
    ? r.items.map((i) => `- ${i.asset.name}: ${i.quantity} ${i.asset.unit} (${CATEGORIES[i.asset.category as Category]?.short ?? i.asset.category})${i.note ? ` — ${i.note}` : ""}`).join("\n")
    : "- (sin equipos marcados)";
  return [
    `Ticket: ${r.ticket}`,
    `Cliente: ${r.client.name} (${r.client.whatsapp}, ${r.client.email})`,
    `Tipo de evento: ${EVENT_TYPES[r.eventType as keyof typeof EVENT_TYPES] ?? r.eventType}`,
    `Montaje: ${fmtDateTime(r.setupDate)} · Inicio del evento: ${fmtDateTime(r.eventDate)}`,
    `Ubicación: ${r.canton}, ${r.province} (${LOCATION_TYPES[r.locationType as keyof typeof LOCATION_TYPES] ?? r.locationType})`,
    r.audience ? `Aforo aproximado: ${r.audience} personas` : null,
    `Equipamiento solicitado:\n${items}`,
    `Descripción del cliente: ${r.description || "(vacío)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSystem(settings: Settings): string {
  const questions = listFromText(settings.aiQualificationQuestions);
  return [
    settings.aiSystemPrompt,
    questions.length ? `Preguntas de calificación (haz solo las que falten, de una en una):\n${questions.map((q) => `- ${q}`).join("\n")}` : "",
    settings.catalogLinks ? `Enlaces que puedes compartir:\n${settings.catalogLinks}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildContext(r: FullRequest, slots: { start: Date }[]): string {
  const booked = r.appointments.filter((a) => a.status === "PROGRAMADA");
  return [
    "<contexto_solicitud>",
    requestSummary(r),
    "</contexto_solicitud>",
    booked.length
      ? `Reunión ya agendada: ${booked.map((a) => `${fmtDateTime(a.start)} (${a.mode.toLowerCase()})`).join(", ")}. No agendes otra salvo que el cliente pida cambiarla.`
      : `Horarios disponibles para la reunión (hora de Ecuador):\n${slots.map((s) => `- ${toLocalInput(s.start)} (${fmtDateTime(s.start)})`).join("\n")}`,
    `Fecha y hora actual: ${fmtDateTime(new Date())}.`,
  ].join("\n");
}

/**
 * Historial de WhatsApp → mensajes de la API (fusiona turnos consecutivos del mismo rol).
 * El primer turno lleva el contexto actualizado de la solicitud y los horarios libres.
 */
function toApiMessages(r: FullRequest, context: string): Anthropic.Beta.BetaMessageParam[] {
  const msgs: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `[Nueva solicitud recibida desde la web]\n${context}\n\nEscribe el primer mensaje de WhatsApp para este cliente.` },
  ];
  for (const m of r.messages) {
    if (m.role === "SYSTEM") continue;
    const role = m.role === "CLIENT" ? "user" : "assistant";
    const content = m.role === "HUMAN" ? `[Mensaje del asesor humano] ${m.content}` : m.content;
    const last = msgs[msgs.length - 1];
    if (last.role === role) last.content = `${last.content as string}\n\n${content}`;
    else msgs.push({ role, content });
  }
  return msgs;
}

async function runTool(r: FullRequest, name: string, input: Record<string, unknown>, settings: Settings): Promise<string> {
  if (name === "agendar_reunion") {
    const start = parseLocal(String(input.inicio));
    if (Number.isNaN(start.getTime())) return "Error: formato de fecha inválido.";
    const slots = await availableSlots(settings);
    const slot = slots.find((s) => s.start.getTime() === start.getTime());
    if (!slot) return "Error: ese horario ya no está disponible. Ofrece otro de la lista.";
    const mode = input.modalidad === "PRESENCIAL" ? "PRESENCIAL" : "VIRTUAL";
    await prisma.appointment.create({
      data: {
        requestId: r.id,
        start: slot.start,
        end: slot.end,
        mode,
        location: mode === "PRESENCIAL" ? "Oficina Producciones Gallardo, Machala" : "Videollamada (enlace enviado por el asesor)",
        notes: "Agendada por el asistente IA",
      },
    });
    await prisma.request.update({ where: { id: r.id }, data: { status: "CITA_AGENDADA" } });
    await prisma.activity.create({
      data: { requestId: r.id, type: "APPOINTMENT", actor: "Asistente IA", message: `Cita ${mode.toLowerCase()} agendada para ${fmtDateTime(slot.start)}` },
    });
    return `Reunión agendada para ${fmtDateTime(slot.start)} (${mode.toLowerCase()}).`;
  }
  if (name === "transferir_a_asesor") {
    const qualified = Boolean(input.calificado);
    const summary = String(input.resumen ?? "");
    await prisma.request.update({ where: { id: r.id }, data: { aiActive: false } });
    await prisma.aiMessage.create({ data: { requestId: r.id, role: "SYSTEM", content: `Transferido a asesor humano. ${qualified ? "Prospecto CALIFICADO." : ""}\n${summary}` } });
    await prisma.activity.create({
      data: { requestId: r.id, type: "NOTE", actor: "Asistente IA", message: `Transferido al asesor${qualified ? " (calificado)" : ""}: ${summary}` },
    });
    if (qualified) {
      await notifyTeam(settings, `🔔 Cliente calificado: ${r.client.name} (${r.ticket})\n${summary}\nWhatsApp: ${r.client.whatsapp}`);
    }
    return "Conversación transferida. Despídete indicando que un asesor continuará la atención en breve.";
  }
  return `Herramienta desconocida: ${name}`;
}

/** Respuesta de respaldo cuando la IA no está disponible. */
function fallbackReply(r: FullRequest, slots: { start: Date }[], firstContact: boolean): string {
  const first = r.client.name.split(" ")[0];
  if (!firstContact) return `Gracias, ${first}. Un asesor de Producciones Gallardo revisará tu mensaje y te responderá en breve.`;
  const options = slots.slice(0, 3).map((s) => `• ${fmtDateTime(s.start)}`).join("\n");
  return `¡Hola ${first}! 👋 Recibimos tu solicitud ${r.ticket} en Producciones Gallardo. Para coordinar la reunión técnica te proponemos:\n${options}\n¿Cuál te queda mejor? ¿Prefieres virtual o presencial en Machala?`;
}

export interface AgentResult {
  reply: string;
  simulated: boolean;
}

/**
 * Genera (y envía por WhatsApp) la siguiente respuesta del agente para una solicitud.
 * `firstContact` = mensaje inicial tras recibir el formulario.
 */
export async function agentRespond(requestId: string, firstContact = false): Promise<AgentResult | null> {
  const settings = await getSettings();
  let r = await loadRequest(requestId);
  if (!r || (!r.aiActive && !firstContact)) return null;
  const slots = await availableSlots(settings);
  const context = buildContext(r, slots);

  let reply = "";
  let simulated = true;
  if (settings.aiEnabled === "true" && aiConfigured()) {
    simulated = false;
    try {
      reply = await callClaude(r, settings, toApiMessages(r, context));
    } catch (e) {
      console.error("[agente] error de la API", e);
      await prisma.activity.create({ data: { requestId, type: "NOTE", actor: "Asistente IA", message: `Error del agente IA: ${String(e).slice(0, 300)}` } });
    }
  }
  if (!reply) {
    simulated = true;
    reply = fallbackReply(r, slots, firstContact);
  }

  r = (await loadRequest(requestId))!;
  const sent = await sendText(r.client.whatsapp, reply);
  await prisma.aiMessage.create({ data: { requestId, role: "AGENT", content: reply, delivered: sent.delivered } });
  if (sent.error) {
    await prisma.activity.create({ data: { requestId, type: "NOTE", actor: "WhatsApp", message: `No se pudo entregar el mensaje: ${sent.error.slice(0, 300)}` } });
  }
  if (r.status === "NUEVO") {
    await prisma.request.update({ where: { id: requestId }, data: { status: "IA_RESPONDIDO" } });
    await prisma.activity.create({ data: { requestId, type: "STATUS", actor: "Asistente IA", message: "Primer contacto automático por WhatsApp → IA Respondido" } });
  }
  return { reply, simulated };
}

async function callClaude(r: FullRequest, settings: Settings, messages: Anthropic.Beta.BetaMessageParam[]): Promise<string> {
  const client = new Anthropic();
  const texts: string[] = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: settings.aiModel || "claude-opus-5-5",
      max_tokens: 4000,
      system: buildSystem(settings),
      messages,
      tools: TOOLS,
      tool_choice: { type: "auto" },
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      // Si los filtros de seguridad rechazan la solicitud, la API reintenta con el modelo de respaldo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") break;
    for (const b of response.content) if (b.type === "text" && b.text.trim()) texts.push(b.text.trim());
    if (response.stop_reason !== "tool_use") break;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const t of toolUses) {
      const content = await runTool(r, t.name, (t.input ?? {}) as Record<string, unknown>, settings);
      results.push({ type: "tool_result", tool_use_id: t.id, content, is_error: content.startsWith("Error") });
    }
    messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({ role: "user", content: results });
  }
  return texts.join("\n\n");
}
