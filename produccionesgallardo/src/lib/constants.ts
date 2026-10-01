export const CATEGORIES = {
  AUDIO: { label: "Audio Profesional", short: "Sonido", color: "sky" },
  VIDEO_LED: { label: "Pantallas LED", short: "Video/LED", color: "violet" },
  ESTRUCTURAS: { label: "Tarimas y Estructuras", short: "Estructuras", color: "amber" },
  BANDA: { label: "Banda en Vivo", short: "Banda en vivo", color: "rose" },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const EVENT_TYPES = {
  BODA: "Boda",
  CONCIERTO: "Concierto",
  CORPORATIVO: "Corporativo",
  FESTIVAL: "Festival",
  OTRO: "Otro",
} as const;
export type EventType = keyof typeof EVENT_TYPES;

export const LOCATION_TYPES = {
  MACHALA: "Machala",
  CANTON_EL_ORO: "Otro cantón de El Oro",
  OTRA_PROVINCIA: "Otra provincia",
} as const;
export type LocationType = keyof typeof LOCATION_TYPES;

/** Columnas del pipeline comercial (Vista 7). */
export const PIPELINE = [
  { key: "NUEVO", label: "Nuevo Lead", hint: "Requerimiento recibido desde la web; webhook disparado." },
  { key: "IA_RESPONDIDO", label: "IA Respondido", hint: "Primer contacto automático completado por WhatsApp." },
  { key: "CITA_AGENDADA", label: "Cita Agendada", hint: "Reunión técnica/comercial pactada con fecha y hora." },
  { key: "COTIZACION_ENVIADA", label: "Cotización Enviada", hint: "Propuesta formal económica emitida al cliente." },
  { key: "CONFIRMADO", label: "Confirmado", hint: "Anticipo pagado; bloquea inventario automáticamente." },
  { key: "CERRADO", label: "Finalizado / Cancelado", hint: "Evento ejecutado o propuesta descartada." },
] as const;

export const STATUSES = {
  NUEVO: "Nuevo Lead",
  IA_RESPONDIDO: "IA Respondido",
  CITA_AGENDADA: "Cita Agendada",
  COTIZACION_ENVIADA: "Cotización Enviada",
  CONFIRMADO: "Confirmado",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
} as const;
export type Status = keyof typeof STATUSES;

export function pipelineColumn(status: string): string {
  return status === "FINALIZADO" || status === "CANCELADO" ? "CERRADO" : status;
}

export const ROLES = {
  ADMIN: "Administrador",
  VENTAS: "Ventas",
  LOGISTICA: "Logística",
} as const;
export type Role = keyof typeof ROLES;

/** Secciones del panel y roles con acceso. */
export const PERMISSIONS = {
  dashboard: ["ADMIN", "VENTAS", "LOGISTICA"],
  calendario: ["ADMIN", "VENTAS", "LOGISTICA"],
  crm: ["ADMIN", "VENTAS"],
  solicitudes: ["ADMIN", "VENTAS", "LOGISTICA"],
  presupuesto: ["ADMIN", "VENTAS"],
  inventario: ["ADMIN", "VENTAS", "LOGISTICA"],
  inventarioEditar: ["ADMIN", "LOGISTICA"],
  configuracion: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export function can(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
