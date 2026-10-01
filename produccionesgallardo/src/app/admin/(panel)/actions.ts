"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CATEGORY_KEYS, ROLES, STATUSES, type Permission } from "@/lib/constants";
import { addHours, fmtDate, fmtDateTime, fmtMoney, parseLocal } from "@/lib/dates";
import { checkAvailability } from "@/lib/availability";
import { blockFor, loadAssets, loadReservations } from "@/lib/inventory";
import { agentRespond } from "@/lib/agent";
import { saveSettings, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { sendText } from "@/lib/whatsapp";

export type ActionResult = { ok: boolean; message?: string };

async function actor(permission: Permission) {
  const user = await requireUser(permission);
  return user;
}

function refreshRequest(id: string) {
  revalidatePath(`/admin/solicitudes/${id}`);
  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  revalidatePath("/admin/calendario");
}

// ───────────── Pipeline / estados ─────────────

/** Cambia el estado. Al confirmar calcula el bloqueo logístico y valida stock. */
export async function changeStatus(requestId: string, status: string): Promise<ActionResult> {
  const user = await actor("crm");
  if (!(status in STATUSES)) return { ok: false, message: "Estado inválido" };
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { items: true, quoteItems: true } });
  if (!r) return { ok: false, message: "Solicitud no encontrada" };
  if (r.status === status) return { ok: true };

  let message: string | undefined;
  const data: { status: string; blockStart?: Date | null; blockEnd?: Date | null; aiActive?: boolean } = { status };
  if (status === "CONFIRMADO") {
    const block = await blockFor(r);
    data.blockStart = block.start;
    data.blockEnd = block.end;
    data.aiActive = false;
    const lines = checkAvailability(
      (r.quoteItems.length ? r.quoteItems : r.items).map((i) => ({ assetId: i.assetId, quantity: i.quantity })),
      await loadAssets(),
      block,
      await loadReservations({ from: block.start, to: block.end }),
      r.id,
    );
    const short = lines.filter((l) => !l.ok);
    if (short.length) {
      message = `Atención: sobre-reserva en ${short.map((l) => `${l.name} (faltan ${l.requested - l.available})`).join(", ")}`;
    }
  } else if (status !== "FINALIZADO") {
    data.blockStart = null;
    data.blockEnd = null;
  }
  if (status === "CANCELADO") data.aiActive = false;

  await prisma.request.update({ where: { id: requestId }, data });
  await prisma.activity.create({
    data: {
      requestId,
      type: "STATUS",
      actor: user.name,
      message: `Estado: ${STATUSES[r.status as keyof typeof STATUSES] ?? r.status} → ${STATUSES[status as keyof typeof STATUSES]}${
        status === "CONFIRMADO" ? ` · inventario bloqueado ${fmtDateTime(data.blockStart!)} – ${fmtDateTime(data.blockEnd!)}` : ""
      }${message ? ` · ${message}` : ""}`,
    },
  });
  refreshRequest(requestId);
  return { ok: true, message };
}

const detailsSchema = z.object({
  setupDate: z.string().min(16),
  eventDate: z.string().min(16),
  eventEndDate: z.string().optional(),
  locationType: z.string(),
  canton: z.string().min(1),
  province: z.string().min(1),
  audience: z.coerce.number().int().min(0).optional(),
});

export async function updateDetails(requestId: string, formData: FormData): Promise<ActionResult> {
  const user = await actor("crm");
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Datos inválidos" };
  const d = parsed.data;
  const setupDate = parseLocal(d.setupDate);
  const eventDate = parseLocal(d.eventDate);
  const eventEndDate = d.eventEndDate ? parseLocal(d.eventEndDate) : null;
  if (setupDate > eventDate || (eventEndDate && eventEndDate < eventDate)) return { ok: false, message: "Revisa el orden de las fechas" };
  const r = await prisma.request.update({
    where: { id: requestId },
    data: { setupDate, eventDate, eventEndDate, locationType: d.locationType, canton: d.canton, province: d.province, audience: d.audience || null },
  });
  if (r.status === "CONFIRMADO") {
    const block = await blockFor(r);
    await prisma.request.update({ where: { id: requestId }, data: { blockStart: block.start, blockEnd: block.end } });
  }
  await prisma.activity.create({ data: { requestId, type: "NOTE", actor: user.name, message: "Datos logísticos actualizados" } });
  refreshRequest(requestId);
  return { ok: true, message: "Guardado" };
}

export async function addNote(requestId: string, text: string): Promise<ActionResult> {
  const user = await actor("solicitudes");
  if (!text.trim()) return { ok: false };
  await prisma.activity.create({ data: { requestId, type: "NOTE", actor: user.name, message: text.trim().slice(0, 2000) } });
  refreshRequest(requestId);
  return { ok: true };
}

// ───────────── Presupuesto ─────────────

const quoteSchema = z.array(
  z.object({ assetId: z.string(), quantity: z.number().int().min(1), unitPrice: z.number().min(0), days: z.number().int().min(1).max(60) }),
);

export async function saveQuote(requestId: string, items: z.input<typeof quoteSchema>, notes: string): Promise<ActionResult> {
  const user = await actor("presupuesto");
  const parsed = quoteSchema.safeParse(items);
  if (!parsed.success) return { ok: false, message: "Ítems inválidos" };
  const total = parsed.data.reduce((t, i) => t + i.quantity * i.unitPrice * i.days, 0);
  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { requestId } }),
    prisma.quoteItem.createMany({ data: parsed.data.map((i) => ({ ...i, requestId })) }),
    prisma.request.update({ where: { id: requestId }, data: { quoteTotal: total, quoteNotes: notes.slice(0, 2000) } }),
    prisma.activity.create({ data: { requestId, type: "QUOTE", actor: user.name, message: `Presupuesto guardado: ${fmtMoney(total)} (${parsed.data.length} ítems)` } }),
  ]);
  refreshRequest(requestId);
  return { ok: true, message: "Presupuesto guardado" };
}

/** Marca la cotización como enviada y opcionalmente envía el resumen por WhatsApp. */
export async function sendQuote(requestId: string, viaWhatsApp: boolean): Promise<ActionResult> {
  const user = await actor("presupuesto");
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { client: true, quoteItems: { include: { asset: true } } } });
  if (!r || !r.quoteItems.length) return { ok: false, message: "Primero guarda el presupuesto" };
  let note = "";
  if (viaWhatsApp) {
    const lines = r.quoteItems.map((i) => `• ${i.asset.name}: ${i.quantity} ${i.asset.unit}${i.days > 1 ? ` × ${i.days} días` : ""} — ${fmtMoney(i.quantity * i.unitPrice * i.days)}`);
    const text = `Hola ${r.client.name.split(" ")[0]}, te compartimos la cotización tentativa de tu evento (${r.ticket}) del ${fmtDate(r.eventDate)}:\n\n${lines.join("\n")}\n\nTotal: ${fmtMoney(r.quoteTotal ?? 0)} + IVA${r.quoteNotes ? `\n\n${r.quoteNotes}` : ""}\n\nQuedamos atentos para confirmar. — ${user.name}, Producciones Gallardo`;
    const sent = await sendText(r.client.whatsapp, text);
    await prisma.aiMessage.create({ data: { requestId, role: "HUMAN", content: text, delivered: sent.delivered } });
    note = sent.simulated ? " (WhatsApp simulado)" : sent.delivered ? " por WhatsApp" : ` (error WhatsApp: ${sent.error})`;
  }
  await prisma.request.update({ where: { id: requestId }, data: { status: r.status === "CONFIRMADO" ? r.status : "COTIZACION_ENVIADA" } });
  await prisma.activity.create({ data: { requestId, type: "QUOTE", actor: user.name, message: `Cotización enviada${note}` } });
  refreshRequest(requestId);
  return { ok: true, message: `Cotización enviada${note}` };
}

// ───────────── Citas ─────────────

export async function createAppointment(requestId: string, formData: FormData): Promise<ActionResult> {
  const user = await actor("crm");
  const start = parseLocal(String(formData.get("start") ?? ""));
  const minutes = Number(formData.get("duration") ?? 45);
  const mode = formData.get("mode") === "PRESENCIAL" ? "PRESENCIAL" : "VIRTUAL";
  if (Number.isNaN(start.getTime())) return { ok: false, message: "Fecha inválida" };
  const end = addHours(start, minutes / 60);
  const clash = await prisma.appointment.findFirst({ where: { status: "PROGRAMADA", start: { lt: end }, end: { gt: start } }, include: { request: { include: { client: true } } } });
  await prisma.appointment.create({
    data: { requestId, start, end, mode, location: String(formData.get("location") ?? ""), notes: String(formData.get("notes") ?? "") },
  });
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (r && ["NUEVO", "IA_RESPONDIDO"].includes(r.status)) await prisma.request.update({ where: { id: requestId }, data: { status: "CITA_AGENDADA" } });
  await prisma.activity.create({ data: { requestId, type: "APPOINTMENT", actor: user.name, message: `Cita ${mode.toLowerCase()} agendada para ${fmtDateTime(start)}` } });
  refreshRequest(requestId);
  return { ok: true, message: clash ? `Cita creada. Ojo: se cruza con la cita de ${clash.request.client.name}` : "Cita creada" };
}

export async function setAppointmentStatus(appointmentId: string, status: "REALIZADA" | "CANCELADA" | "PROGRAMADA"): Promise<ActionResult> {
  const user = await actor("crm");
  const a = await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
  await prisma.activity.create({ data: { requestId: a.requestId, type: "APPOINTMENT", actor: user.name, message: `Cita del ${fmtDateTime(a.start)} marcada como ${status.toLowerCase()}` } });
  refreshRequest(a.requestId);
  return { ok: true };
}

// ───────────── WhatsApp / IA ─────────────

export async function sendHumanMessage(requestId: string, text: string): Promise<ActionResult> {
  const user = await actor("crm");
  const body = text.trim();
  if (!body) return { ok: false };
  const r = await prisma.request.findUnique({ where: { id: requestId }, include: { client: true } });
  if (!r) return { ok: false };
  const sent = await sendText(r.client.whatsapp, body);
  await prisma.aiMessage.create({ data: { requestId, role: "HUMAN", content: body, delivered: sent.delivered } });
  if (r.aiActive) await prisma.request.update({ where: { id: requestId }, data: { aiActive: false } });
  await prisma.activity.create({ data: { requestId, type: "NOTE", actor: user.name, message: "Asesor tomó la conversación de WhatsApp" } });
  refreshRequest(requestId);
  return { ok: true, message: sent.simulated ? "Mensaje registrado (WhatsApp en modo simulado)" : sent.delivered ? "Enviado" : `Error: ${sent.error}` };
}

export async function setAiActive(requestId: string, active: boolean): Promise<ActionResult> {
  const user = await actor("crm");
  await prisma.request.update({ where: { id: requestId }, data: { aiActive: active } });
  await prisma.activity.create({ data: { requestId, type: "NOTE", actor: user.name, message: active ? "Asistente IA reactivado" : "Asistente IA pausado" } });
  refreshRequest(requestId);
  return { ok: true };
}

/** Simula un mensaje entrante del cliente (pruebas sin WhatsApp configurado). */
export async function simulateClientMessage(requestId: string, text: string): Promise<ActionResult> {
  await actor("configuracion");
  if (!text.trim()) return { ok: false };
  await prisma.aiMessage.create({ data: { requestId, role: "CLIENT", content: text.trim(), delivered: true } });
  const res = await agentRespond(requestId);
  refreshRequest(requestId);
  return { ok: true, message: res ? (res.simulated ? "Respuesta generada en modo de respaldo (sin API de IA)" : "El agente respondió") : "IA pausada para esta solicitud" };
}

// ───────────── Inventario ─────────────

const assetSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORY_KEYS as [string, ...string[]]),
  unit: z.string().trim().min(1).max(20),
  totalStock: z.coerce.number().int().min(0),
  maintenanceUnits: z.coerce.number().int().min(0),
  dailyRate: z.coerce.number().min(0),
  description: z.string().max(1000).default(""),
  specs: z.string().max(2000).default(""),
  recommendedCapacity: z.string().max(300).default(""),
  imageUrl: z.string().max(500).default(""),
  specSheetUrl: z.string().max(500).default(""),
  publicVisible: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveAsset(formData: FormData): Promise<ActionResult> {
  await actor("inventarioEditar");
  const parsed = assetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join(" · ") };
  const { id, imageUrl, specSheetUrl, ...d } = parsed.data;
  if (d.maintenanceUnits > d.totalStock) return { ok: false, message: "Las unidades en mantenimiento no pueden superar el stock total" };
  const data = { ...d, imageUrl: imageUrl || null, specSheetUrl: specSheetUrl || null };
  if (id) await prisma.asset.update({ where: { id }, data });
  else await prisma.asset.create({ data });
  revalidatePath("/admin/inventario");
  return { ok: true, message: id ? "Activo actualizado" : "Activo creado" };
}

export async function toggleAsset(id: string, active: boolean): Promise<ActionResult> {
  await actor("inventarioEditar");
  await prisma.asset.update({ where: { id }, data: { active } });
  revalidatePath("/admin/inventario");
  return { ok: true };
}

const ruleSchema = z.object({
  id: z.string().optional(),
  canton: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  extraHours: z.coerce.number().int().min(0).max(240),
  note: z.string().max(300).default(""),
  lat: z.union([z.literal("").transform(() => null), z.coerce.number().min(-90).max(90)]).optional(),
  lng: z.union([z.literal("").transform(() => null), z.coerce.number().min(-180).max(180)]).optional(),
  covered: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function saveTransferRule(formData: FormData): Promise<ActionResult> {
  await actor("inventarioEditar");
  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Datos inválidos" };
  const { id, ...d } = parsed.data;
  try {
    if (id) await prisma.transferRule.update({ where: { id }, data: d });
    else await prisma.transferRule.create({ data: d });
  } catch {
    return { ok: false, message: "Ya existe una regla para ese cantón" };
  }
  revalidatePath("/admin/inventario");
  return { ok: true, message: "Regla guardada" };
}

export async function deleteTransferRule(id: string): Promise<ActionResult> {
  await actor("inventarioEditar");
  await prisma.transferRule.delete({ where: { id } });
  revalidatePath("/admin/inventario");
  return { ok: true };
}

// ───────────── Configuración ─────────────

export async function updateSettings(formData: FormData): Promise<ActionResult> {
  await actor("configuracion");
  const values: Partial<Record<SettingKey, string>> = {};
  for (const [k, v] of formData.entries()) if (k in SETTING_DEFAULTS) values[k as SettingKey] = String(v);
  if (formData.has("aiEnabledPresent")) values.aiEnabled = formData.get("aiEnabled") === "on" ? "true" : "false";
  if (values.bandFormats) {
    try {
      if (!Array.isArray(JSON.parse(values.bandFormats))) throw new Error();
    } catch {
      return { ok: false, message: "Los formatos de banda deben ser un JSON válido (lista)" };
    }
  }
  await saveSettings(values);
  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
  return { ok: true, message: "Configuración guardada" };
}

const userSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((e) => e.toLowerCase()),
  role: z.enum(Object.keys(ROLES) as [string, ...string[]]),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function createUser(formData: FormData): Promise<ActionResult> {
  await actor("configuracion");
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { password, ...d } = parsed.data;
  try {
    await prisma.user.create({ data: { ...d, passwordHash: await bcrypt.hash(password, 10) } });
  } catch {
    return { ok: false, message: "Ya existe un usuario con ese correo" };
  }
  revalidatePath("/admin/configuracion");
  return { ok: true, message: "Usuario creado" };
}

export async function updateUser(id: string, data: { role?: string; active?: boolean; password?: string }): Promise<ActionResult> {
  const me = await actor("configuracion");
  if (id === me.id && (data.active === false || (data.role && data.role !== "ADMIN"))) {
    return { ok: false, message: "No puedes desactivarte ni quitarte el rol de administrador" };
  }
  if (data.role && !(data.role in ROLES)) return { ok: false, message: "Rol inválido" };
  if (data.password !== undefined && data.password.length < 8) return { ok: false, message: "Mínimo 8 caracteres" };
  await prisma.user.update({
    where: { id },
    data: {
      role: data.role,
      active: data.active,
      passwordHash: data.password ? await bcrypt.hash(data.password, 10) : undefined,
    },
  });
  revalidatePath("/admin/configuracion");
  return { ok: true, message: "Usuario actualizado" };
}
