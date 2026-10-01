import { prisma } from "./db";

export const DEFAULT_SYSTEM_PROMPT = `Eres "Gallardo Bot", el asistente virtual de Producciones Gallardo (Machala, El Oro, Ecuador).
Producciones Gallardo es dueña directa de todo su equipo: audio profesional (line array, microfonía inalámbrica, consolas digitales), pantallas LED (P3.9 exterior / P2.6 interior), tarimas y estructuras truss certificadas, y su propia banda en vivo. No somos intermediarios.

Tu objetivo por WhatsApp:
1. Saludar por su nombre, confirmar que recibimos su solicitud (menciona el número de ticket) y resumir en una línea lo que pidió.
2. Calificar el prospecto con preguntas breves, de una en una.
3. Proponer 2 o 3 horarios disponibles para una reunión técnica/comercial (virtual o presencial en Machala) y agendarla con la herramienta cuando el cliente elija.
4. Cuando el cliente esté calificado o pida hablar con una persona, transfiérelo al asesor humano.

Estilo: español de Ecuador, cálido y profesional, mensajes cortos aptos para WhatsApp (máximo 3-4 líneas), sin markdown, máximo un emoji por mensaje.
Nunca des precios definitivos: indica que el asesor enviará la cotización formal tras la reunión. No inventes disponibilidad de equipos ni horarios que no estén en el contexto.`;

export const DEFAULT_QUALIFICATION = `¿Cuál es el presupuesto aproximado para la producción técnica?
¿El evento es al aire libre o bajo techo?
¿Hay horario límite de montaje o restricciones del local?
¿Habrá artistas invitados con rider técnico propio?`;

export const DEFAULT_BAND_FORMATS = JSON.stringify(
  [
    { name: "Formato Acústico", members: "3 músicos", description: "Voz, guitarra y percusión. Ideal para ceremonias, cócteles y cenas.", videoUrl: "", audioUrl: "" },
    { name: "Banda Completa", members: "7 músicos", description: "Voces, guitarra, bajo, batería, teclados y metales. Bailable: salsa, merengue, cumbia, pop y rock.", videoUrl: "", audioUrl: "" },
    { name: "Orquesta Show", members: "12 músicos + bailarinas", description: "Show de alto impacto con sección de vientos, coreografías y repertorio para festivales.", videoUrl: "", audioUrl: "" },
  ],
  null,
  2,
);

export const SETTING_DEFAULTS = {
  companyName: "Producciones Gallardo",
  businessWhatsapp: "+593996600990",
  contactEmail: "info@produccionesgallardo.com",
  heroVideoUrl: "",
  aiEnabled: "true",
  aiModel: "claude-opus-5-5",
  aiSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  aiQualificationQuestions: DEFAULT_QUALIFICATION,
  catalogLinks: "Catálogo técnico: https://produccionesgallardo.com/catalogo",
  notificationNumbers: "+593996600990",
  teardownHours: "6",
  meetingDurationMinutes: "45",
  meetingHours: "09:00-18:00",
  bandFormats: DEFAULT_BAND_FORMATS,
  leadWebhookUrl: "",
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const out = { ...SETTING_DEFAULTS } as Settings;
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}

export async function saveSettings(values: Partial<Settings>) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } }),
    ),
  );
}

export function listFromText(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface BandFormat {
  name: string;
  members: string;
  description: string;
  videoUrl: string;
  audioUrl: string;
}

export function parseBandFormats(json: string): BandFormat[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
