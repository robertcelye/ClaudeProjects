import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/agent";
import { whatsappConfigured } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin";
import { SettingsForm, UsersManager } from "./ConfigClient";

const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (recomendado)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (más rápido y económico)" },
];

function Status({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className="font-semibold">{ok ? "✔" : "⚠"} {label}</p>
      <p className="text-xs text-slate-600">{hint}</p>
    </div>
  );
}

export default async function ConfiguracionPage() {
  const me = await requireUser("configuracion");
  const [s, users, h] = await Promise.all([getSettings(), prisma.user.findMany({ orderBy: { createdAt: "asc" } }), headers()]);
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <>
      <PageHeader title="Configuración del sistema y agente IA" />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Status ok={aiConfigured()} label="API de Claude" hint={aiConfigured() ? "ANTHROPIC_API_KEY configurada" : "Sin ANTHROPIC_API_KEY: el agente usa respuestas de respaldo"} />
        <Status ok={whatsappConfigured()} label="WhatsApp Cloud API" hint={whatsappConfigured() ? "Envío real de mensajes activo" : "Sin WHATSAPP_TOKEN / PHONE_NUMBER_ID: modo simulado"} />
        <Status ok={Boolean(process.env.WHATSAPP_VERIFY_TOKEN)} label="Webhook entrante" hint={`${origin}/api/whatsapp/webhook`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5 xl:row-span-2">
          <h2 className="mb-4 font-bold">🤖 Configuración del modelo</h2>
          <SettingsForm>
            <input type="hidden" name="aiEnabledPresent" value="1" />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="aiEnabled" defaultChecked={s.aiEnabled === "true"} /> Asistente IA activo para nuevos leads
            </label>
            <label className="block">
              <span className="label">Modelo</span>
              <select name="aiModel" defaultValue={s.aiModel} className="input">
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Prompt del sistema (tono de voz de la empresa)</span>
              <textarea name="aiSystemPrompt" rows={14} defaultValue={s.aiSystemPrompt} className="input font-mono text-xs" />
            </label>
            <label className="block">
              <span className="label">Preguntas de calificación (una por línea)</span>
              <textarea name="aiQualificationQuestions" rows={5} defaultValue={s.aiQualificationQuestions} className="input" />
            </label>
            <label className="block">
              <span className="label">Enlaces de catálogo que el agente puede compartir</span>
              <textarea name="catalogLinks" rows={3} defaultValue={s.catalogLinks} className="input" />
            </label>
          </SettingsForm>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold">🔔 Parámetros de notificación</h2>
          <SettingsForm>
            <label className="block">
              <span className="label">WhatsApp que reciben alertas de clientes calificados (uno por línea)</span>
              <textarea name="notificationNumbers" rows={3} defaultValue={s.notificationNumbers} className="input font-mono" />
            </label>
            <label className="block">
              <span className="label">WhatsApp público de la empresa (botón “escribir primero”)</span>
              <input name="businessWhatsapp" defaultValue={s.businessWhatsapp} className="input font-mono" />
            </label>
            <label className="block">
              <span className="label">Webhook externo al recibir un lead (n8n, Make, Zapier — opcional)</span>
              <input name="leadWebhookUrl" defaultValue={s.leadWebhookUrl} placeholder="https://…" className="input" />
            </label>
          </SettingsForm>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold">📅 Agenda y logística</h2>
          <SettingsForm>
            <div className="grid gap-3 sm:grid-cols-3">
              <label><span className="label">Horario de reuniones</span><input name="meetingHours" defaultValue={s.meetingHours} pattern="\d{2}:\d{2}-\d{2}:\d{2}" className="input" /></label>
              <label><span className="label">Duración cita (min)</span><input name="meetingDurationMinutes" type="number" min={15} defaultValue={s.meetingDurationMinutes} className="input" /></label>
              <label><span className="label">Horas de desmontaje</span><input name="teardownHours" type="number" min={0} defaultValue={s.teardownHours} className="input" /></label>
            </div>
          </SettingsForm>
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="mb-4 font-bold">🌐 Portal público</h2>
        <SettingsForm>
          <div className="grid gap-3 md:grid-cols-3">
            <label><span className="label">Nombre comercial</span><input name="companyName" defaultValue={s.companyName} className="input" /></label>
            <label><span className="label">Correo de contacto</span><input name="contactEmail" defaultValue={s.contactEmail} className="input" /></label>
            <label><span className="label">Video reel del hero (URL .mp4)</span><input name="heroVideoUrl" defaultValue={s.heroVideoUrl} placeholder="/media/reel.mp4" className="input" /></label>
          </div>
          <label className="block">
            <span className="label">Formatos de la banda (JSON: name, members, description, videoUrl, audioUrl)</span>
            <textarea name="bandFormats" rows={10} defaultValue={s.bandFormats} className="input font-mono text-xs" />
          </label>
        </SettingsForm>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-1 font-bold">🔐 Gestión de accesos</h2>
        <p className="mb-4 text-xs text-slate-500">Administrador: acceso total · Ventas: tablero, calendario, CRM, presupuestos · Logística: tablero, calendario, inventario y expedientes (solo lectura comercial).</p>
        <UsersManager meId={me.id} users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }))} />
      </section>
    </>
  );
}
