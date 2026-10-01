"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CATEGORIES, CATEGORY_KEYS, EVENT_TYPES, LOCATION_TYPES, type Category } from "@/lib/constants";
import { normalizeEcPhone } from "@/lib/phone";
import { submitLead } from "./actions";

export interface WizardAsset {
  id: string;
  name: string;
  category: string;
  unit: string;
  recommendedCapacity: string;
}

type Item = { assetId: string; quantity: number; note: string };
type Form = {
  eventType: string;
  setupDate: string;
  eventDate: string;
  locationType: string;
  canton: string;
  province: string;
  audience: string;
  items: Item[];
  description: string;
  name: string;
  email: string;
  whatsapp: string;
};

const EMPTY: Form = {
  eventType: "",
  setupDate: "",
  eventDate: "",
  locationType: "MACHALA",
  canton: "",
  province: "",
  audience: "",
  items: [],
  description: "",
  name: "",
  email: "",
  whatsapp: "",
};

const STEPS = ["Datos logísticos", "Equipamiento", "Descripción", "Contacto"];
const DRAFT_KEY = "pg-cotizacion-borrador";
const AUDIENCE = ["50", "150", "300", "600", "1000", "2500", "5000", "10000"];
const PROVINCES = ["Azuay", "Guayas", "Loja", "Los Ríos", "Manabí", "Pichincha", "Santa Elena", "Otra"];

export function QuoteWizard({ assets, cantons, preselect }: { assets: WizardAsset[]; cantons: string[]; preselect?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [minDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));

  // Restaurar borrador (reduce abandono) y preselección desde el catálogo
  useEffect(() => {
    let draft: Form | null = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) draft = { ...EMPTY, ...JSON.parse(raw) };
    } catch {}
    const base = draft ?? EMPTY;
    const withPre =
      preselect && assets.some((a) => a.id === preselect) && !base.items.some((i) => i.assetId === preselect)
        ? { ...base, items: [...base.items, { assetId: preselect, quantity: 1, note: "" }] }
        : base;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde sessionStorage
    setForm(withPre);
  }, [assets, preselect]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const byCat = useMemo(() => CATEGORY_KEYS.map((c) => ({ c, list: assets.filter((a) => a.category === c) })), [assets]);
  const item = (id: string) => form.items.find((i) => i.assetId === id);
  const toggle = (id: string) =>
    set("items", item(id) ? form.items.filter((i) => i.assetId !== id) : [...form.items, { assetId: id, quantity: 1, note: "" }]);
  const setQty = (id: string, q: number) => set("items", form.items.map((i) => (i.assetId === id ? { ...i, quantity: Math.max(1, q || 1) } : i)));

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.eventType) e.eventType = "Selecciona el tipo de evento";
      if (!form.setupDate) e.setupDate = "Indica la fecha de montaje";
      if (!form.eventDate) e.eventDate = "Indica la fecha de inicio del evento";
      if (form.setupDate && form.eventDate && form.setupDate > form.eventDate) e.setupDate = "El montaje debe ser antes del evento";
      if (form.locationType === "CANTON_EL_ORO" && !form.canton) e.canton = "Selecciona el cantón";
      if (form.locationType === "OTRA_PROVINCIA" && !form.province) e.province = "Selecciona la provincia";
    }
    if (s === 1 && form.items.length === 0) e.items = "Selecciona al menos un equipo o servicio";
    if (s === 3) {
      if (form.name.trim().length < 3) e.name = "Ingresa tu nombre completo";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Correo inválido";
      if (!normalizeEcPhone(form.whatsapp)) e.whatsapp = "Número inválido. Formato: +593 9X XXX XXXX";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => validate(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  function submit() {
    if (!validate(3)) return;
    startTransition(async () => {
      const res = await submitLead({ ...form, audience: form.audience ? Number(form.audience) : undefined });
      if (res.ok) {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {}
        router.push(`/cotizar/confirmacion/${res.ticket}`);
      } else {
        setErrors(res.errors);
        const firstStep = ["eventType", "setupDate", "eventDate", "locationType", "canton", "province"].some((k) => res.errors[k])
          ? 0
          : res.errors.items
            ? 1
            : res.errors.description
              ? 2
              : 3;
        setStep(firstStep);
      }
    });
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-400">{errors[k]}</p>;

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800 p-5 sm:p-8">
      {/* Progreso */}
      <ol className="mb-8 grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <div className={`h-1.5 rounded-full transition ${i <= step ? "bg-gold-500" : "bg-white/10"}`} />
            <p className={`mt-2 hidden text-xs font-semibold sm:block ${i === step ? "text-gold-300" : "text-white/40"}`}>
              {i + 1}. {label}
            </p>
          </li>
        ))}
      </ol>
      <h2 className="mb-6 text-xl font-bold sm:hidden">
        Paso {step + 1}: {STEPS[step]}
      </h2>

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <span className="label">Tipo de evento</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Object.entries(EVENT_TYPES).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("eventType", k)}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                    form.eventType === k ? "border-gold-500 bg-gold-500/15 text-gold-300" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            {err("eventType")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Fecha y hora estimada de montaje</span>
              <input type="datetime-local" min={minDate} className="input [color-scheme:dark]" value={form.setupDate} onChange={(e) => set("setupDate", e.target.value)} />
              {err("setupDate")}
            </label>
            <label>
              <span className="label">Fecha y hora de inicio del evento</span>
              <input type="datetime-local" min={form.setupDate || minDate} className="input [color-scheme:dark]" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
              {err("eventDate")}
            </label>
          </div>
          <div>
            <span className="label">Ubicación</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(LOCATION_TYPES).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("locationType", k)}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                    form.locationType === k ? "border-gold-500 bg-gold-500/15 text-gold-300" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          {form.locationType === "CANTON_EL_ORO" && (
            <label className="block">
              <span className="label">Cantón</span>
              <select className="input" value={form.canton} onChange={(e) => set("canton", e.target.value)}>
                <option value="">Selecciona…</option>
                {cantons.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {err("canton")}
            </label>
          )}
          {form.locationType === "OTRA_PROVINCIA" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Provincia</span>
                <select className="input" value={form.province} onChange={(e) => set("province", e.target.value)}>
                  <option value="">Selecciona…</option>
                  {PROVINCES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                {err("province")}
              </label>
              <label>
                <span className="label">Ciudad (opcional)</span>
                <input className="input" value={form.canton} onChange={(e) => set("canton", e.target.value)} placeholder="Ej. Cuenca" />
              </label>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-8">
          <label className="block max-w-sm">
            <span className="label">Aforo aproximado de personas</span>
            <select className="input" value={form.audience} onChange={(e) => set("audience", e.target.value)}>
              <option value="">No lo sé aún</option>
              {AUDIENCE.map((a) => (
                <option key={a} value={a}>
                  Hasta {Number(a).toLocaleString("es-EC")} personas
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-white/45">Con el aforo dimensionamos el sistema de sonido y el tamaño de pantalla.</p>
          </label>
          {byCat.map(({ c, list }) =>
            list.length === 0 ? null : (
              <fieldset key={c}>
                <legend className="mb-3 text-sm font-bold text-gold-300">{CATEGORIES[c as Category].label}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((a) => {
                    const it = item(a.id);
                    return (
                      <div key={a.id} className={`rounded-xl border p-3 transition ${it ? "border-gold-500/60 bg-gold-500/10" : "border-white/10"}`}>
                        <label className="flex cursor-pointer items-start gap-3">
                          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#f5b301]" checked={!!it} onChange={() => toggle(a.id)} />
                          <span>
                            <span className="block text-sm font-semibold">{a.name}</span>
                            {a.recommendedCapacity && <span className="block text-xs text-white/45">{a.recommendedCapacity}</span>}
                          </span>
                        </label>
                        {it && (
                          <div className="mt-3 flex items-center gap-2 pl-7">
                            <span className="text-xs text-white/60">Cantidad aprox.:</span>
                            <input
                              type="number"
                              min={1}
                              className="input w-24 py-1.5"
                              value={it.quantity}
                              onChange={(e) => setQty(a.id, Number(e.target.value))}
                              aria-label={`Cantidad de ${a.name}`}
                            />
                            <span className="text-xs text-white/60">{a.unit}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ),
          )}
          {err("items")}
        </div>
      )}

      {step === 2 && (
        <label className="block">
          <span className="label">Cuéntanos más de tu evento</span>
          <textarea
            rows={7}
            className="input"
            maxLength={3000}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Cuéntanos si tienes horario límite de montaje, artistas invitados o requerimientos especiales."
          />
          <p className="mt-1 text-right text-xs text-white/40">{form.description.length}/3000</p>
        </label>
      )}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="label">Nombre completo</span>
            <input className="input" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            {err("name")}
          </label>
          <label>
            <span className="label">Correo electrónico</span>
            <input type="email" className="input" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            {err("email")}
          </label>
          <label>
            <span className="label">WhatsApp</span>
            <div className="flex">
              <span className="flex items-center rounded-l-lg border border-r-0 border-white/10 bg-white/10 px-3 text-sm">🇪🇨 +593</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="input rounded-l-none"
                placeholder="99 123 4567"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                onBlur={() => {
                  const n = normalizeEcPhone(form.whatsapp);
                  if (n) set("whatsapp", n);
                }}
              />
            </div>
            {err("whatsapp")}
          </label>
          <p className="text-xs text-white/45 sm:col-span-2">Nuestro asistente virtual te escribirá a este número para coordinar la reunión.</p>
          {errors.form && <p className="text-sm text-red-400 sm:col-span-2">{errors.form}</p>}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        <button type="button" onClick={back} disabled={step === 0 || pending} className="btn-ghost">
          ← Atrás
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="btn-gold">
            Continuar →
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={pending} className="btn-gold">
            {pending ? "Enviando…" : "Enviar solicitud"}
          </button>
        )}
      </div>
    </div>
  );
}
