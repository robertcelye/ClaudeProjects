"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CATEGORIES, LOCATION_TYPES, STATUSES, type Category } from "@/lib/constants";
import {
  addNote,
  changeStatus,
  createAppointment,
  saveQuote,
  sendHumanMessage,
  sendQuote,
  setAiActive,
  setAppointmentStatus,
  simulateClientMessage,
  updateDetails,
  type ActionResult,
} from "../../actions";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.message ? { text: r.message, ok: r.ok } : null);
      if (r.ok) after?.();
      router.refresh();
    });
  const note = msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>;
  return { pending, run, note };
}

export function StatusControl({ id, status }: { id: string; status: string }) {
  const { pending, run, note } = useAction();
  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label="Estado"
          defaultValue={status}
          key={status}
          disabled={pending}
          onChange={(e) => run(() => changeStatus(id, e.target.value))}
          className="input w-auto py-1.5"
        >
          {Object.entries(STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {note}
    </div>
  );
}

export function DetailsForm({
  id,
  values,
  cantons,
}: {
  id: string;
  values: { setupDate: string; eventDate: string; eventEndDate: string; locationType: string; canton: string; province: string; audience: string };
  cantons: string[];
}) {
  const { pending, run, note } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-semibold text-amber-700 hover:underline">Editar datos logísticos</button>;
  return (
    <form action={(fd) => run(() => updateDetails(id, fd), () => setOpen(false))} className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
      <label><span className="label">Montaje</span><input name="setupDate" type="datetime-local" defaultValue={values.setupDate} className="input" required /></label>
      <label><span className="label">Inicio evento</span><input name="eventDate" type="datetime-local" defaultValue={values.eventDate} className="input" required /></label>
      <label><span className="label">Fin evento</span><input name="eventEndDate" type="datetime-local" defaultValue={values.eventEndDate} className="input" /></label>
      <label><span className="label">Aforo</span><input name="audience" type="number" min={0} defaultValue={values.audience} className="input" /></label>
      <label>
        <span className="label">Tipo de ubicación</span>
        <select name="locationType" defaultValue={values.locationType} className="input">
          {Object.entries(LOCATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Cantón / ciudad</span>
        <input name="canton" list="cantones" defaultValue={values.canton} className="input" required />
        <datalist id="cantones">{cantons.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label><span className="label">Provincia</span><input name="province" defaultValue={values.province} className="input" required /></label>
      <div className="flex items-end gap-2">
        <button disabled={pending} className="btn-dark">Guardar</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button>
      </div>
      {note}
    </form>
  );
}

export interface Msg {
  id: string;
  role: string;
  content: string;
  at: string;
  delivered: boolean;
}

export function Conversation({ id, messages, aiActive, waHref, canSimulate }: { id: string; messages: Msg[]; aiActive: boolean; waHref: string; canSimulate: boolean }) {
  const { pending, run, note } = useAction();
  const [text, setText] = useState("");
  const [sim, setSim] = useState("");
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`chip ${aiActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"}`}>{aiActive ? "🤖 IA activa" : "👤 Atención humana"}</span>
        <button disabled={pending} onClick={() => run(() => setAiActive(id, !aiActive))} className="text-xs font-semibold text-amber-700 hover:underline">
          {aiActive ? "Pausar IA y tomar conversación" : "Reactivar asistente IA"}
        </button>
        <a href={waHref} target="_blank" rel="noreferrer" className="ml-auto text-xs font-semibold text-emerald-700 hover:underline">Abrir chat de WhatsApp ↗</a>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg bg-[#efeae2] p-3">
        {messages.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Sin mensajes todavía.</p>}
        {messages.map((m) =>
          m.role === "SYSTEM" ? (
            <p key={m.id} className="mx-auto max-w-[90%] rounded-md bg-amber-50 px-3 py-1.5 text-center text-xs whitespace-pre-line text-amber-900">{m.content}</p>
          ) : (
            <div key={m.id} className={`flex ${m.role === "CLIENT" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.role === "CLIENT" ? "bg-white" : m.role === "HUMAN" ? "bg-amber-100" : "bg-[#d9fdd3]"}`}>
                <p className="mb-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">{m.role === "CLIENT" ? "Cliente" : m.role === "HUMAN" ? "Asesor" : "Asistente IA"}</p>
                <p className="whitespace-pre-line">{m.content}</p>
                <p className="mt-1 text-right text-[10px] text-slate-400">{m.at}{m.role !== "CLIENT" && (m.delivered ? " ✓✓" : " · simulado")}</p>
              </div>
            </div>
          ),
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        action={() => run(() => sendHumanMessage(id, text), () => setText(""))}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Responder como asesor por WhatsApp…" className="input" />
        <button disabled={pending || !text.trim()} className="btn-dark">Enviar</button>
      </form>
      {canSimulate && (
        <form className="mt-2 flex gap-2" action={() => run(() => simulateClientMessage(id, sim), () => setSim(""))}>
          <input value={sim} onChange={(e) => setSim(e.target.value)} placeholder="Probar: simular mensaje entrante del cliente" className="input border-dashed text-xs" />
          <button disabled={pending || !sim.trim()} className="btn-ghost text-xs">{pending ? "…" : "Simular"}</button>
        </form>
      )}
      {note}
    </div>
  );
}

export interface Appt {
  id: string;
  when: string;
  mode: string;
  status: string;
  location: string;
  notes: string;
}

export function Appointments({ id, items, suggested }: { id: string; items: Appt[]; suggested: string }) {
  const { pending, run, note } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <ul className="space-y-2">
        {items.length === 0 && <li className="text-sm text-slate-500">Sin citas.</li>}
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${a.status === "PROGRAMADA" ? "bg-blue-600" : a.status === "REALIZADA" ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className="font-semibold">{a.when}</span>
            <span className="text-slate-500">{a.mode === "VIRTUAL" ? "Virtual" : "Presencial"}{a.location && ` · ${a.location}`}</span>
            <span className="ml-auto flex gap-2 text-xs">
              {a.status === "PROGRAMADA" ? (
                <>
                  <button disabled={pending} onClick={() => run(() => setAppointmentStatus(a.id, "REALIZADA"))} className="font-semibold text-emerald-700 hover:underline">Realizada</button>
                  <button disabled={pending} onClick={() => run(() => setAppointmentStatus(a.id, "CANCELADA"))} className="font-semibold text-red-600 hover:underline">Cancelar</button>
                </>
              ) : (
                <span className="text-slate-400">{a.status.toLowerCase()}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {open ? (
        <form action={(fd) => run(() => createAppointment(id, fd), () => setOpen(false))} className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
          <label><span className="label">Inicio</span><input name="start" type="datetime-local" defaultValue={suggested} required className="input" /></label>
          <label>
            <span className="label">Duración</span>
            <select name="duration" defaultValue="45" className="input"><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option></select>
          </label>
          <label>
            <span className="label">Modalidad</span>
            <select name="mode" className="input"><option value="VIRTUAL">Virtual</option><option value="PRESENCIAL">Presencial</option></select>
          </label>
          <label><span className="label">Lugar / enlace</span><input name="location" className="input" placeholder="Meet, Zoom u oficina" /></label>
          <label className="sm:col-span-2"><span className="label">Notas</span><input name="notes" className="input" /></label>
          <div className="flex gap-2"><button disabled={pending} className="btn-dark">Agendar</button><button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancelar</button></div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-3 text-xs font-semibold text-amber-700 hover:underline">+ Agendar cita</button>
      )}
      {note}
    </div>
  );
}

export interface QuoteAsset {
  id: string;
  name: string;
  category: string;
  unit: string;
  dailyRate: number;
  available: number;
}
interface Line { assetId: string; quantity: number; unitPrice: number; days: number; on: boolean }

export function QuoteBuilder({
  id,
  assets,
  initial,
  notes: initialNotes,
  canEdit,
}: {
  id: string;
  assets: QuoteAsset[];
  initial: { assetId: string; quantity: number; unitPrice: number; days: number }[];
  notes: string;
  canEdit: boolean;
}) {
  const { pending, run, note } = useAction();
  const [lines, setLines] = useState<Record<string, Line>>(() => {
    const map: Record<string, Line> = {};
    for (const a of assets) map[a.id] = { assetId: a.id, quantity: 1, unitPrice: a.dailyRate, days: 1, on: false };
    for (const i of initial) if (map[i.assetId]) map[i.assetId] = { ...i, on: true };
    return map;
  });
  const [notes, setNotes] = useState(initialNotes);
  const [showAll, setShowAll] = useState(false);
  const selected = Object.values(lines).filter((l) => l.on);
  const total = selected.reduce((t, l) => t + l.quantity * l.unitPrice * l.days, 0);
  const money = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(n);
  const upd = (aid: string, patch: Partial<Line>) => setLines((ls) => ({ ...ls, [aid]: { ...ls[aid], ...patch } }));
  const shown = useMemo(() => (showAll ? assets : assets.filter((a) => lines[a.id]?.on)), [assets, lines, showAll]);
  const payload = () => selected.map(({ assetId, quantity, unitPrice, days }) => ({ assetId, quantity, unitPrice, days }));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="py-2 pr-2" />
              <th className="py-2 pr-2">Ítem</th>
              <th className="py-2 pr-2">Cant.</th>
              <th className="py-2 pr-2">Precio u.</th>
              <th className="py-2 pr-2">Días</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => {
              const l = lines[a.id];
              const over = l.on && l.quantity > a.available;
              return (
                <tr key={a.id} className={`border-b border-slate-100 ${l.on ? "" : "text-slate-400"}`}>
                  <td className="py-1.5 pr-2"><input type="checkbox" disabled={!canEdit} checked={l.on} onChange={(e) => upd(a.id, { on: e.target.checked })} aria-label={`Incluir ${a.name}`} /></td>
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{a.name}</span>
                    <span className="block text-[11px] text-slate-400">{CATEGORIES[a.category as Category]?.short} · disp. {a.available} {a.unit}</span>
                    {over && <span className="block text-[11px] font-semibold text-red-600">Supera la disponibilidad</span>}
                  </td>
                  <td className="py-1.5 pr-2"><input type="number" min={1} disabled={!l.on || !canEdit} value={l.quantity} onChange={(e) => upd(a.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="input w-20 px-2 py-1" /></td>
                  <td className="py-1.5 pr-2"><input type="number" min={0} step="0.01" disabled={!l.on || !canEdit} value={l.unitPrice} onChange={(e) => upd(a.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} className="input w-24 px-2 py-1" /></td>
                  <td className="py-1.5 pr-2"><input type="number" min={1} disabled={!l.on || !canEdit} value={l.days} onChange={(e) => upd(a.id, { days: Math.max(1, Number(e.target.value) || 1) })} className="input w-16 px-2 py-1" /></td>
                  <td className="py-1.5 text-right font-medium">{l.on ? money(l.quantity * l.unitPrice * l.days) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="text-right">
            <tr><td colSpan={5} className="pt-3 text-slate-500">Subtotal</td><td className="pt-3 font-medium">{money(total)}</td></tr>
            <tr><td colSpan={5} className="text-slate-500">IVA 15 %</td><td>{money(total * 0.15)}</td></tr>
            <tr><td colSpan={5} className="font-bold">Total</td><td className="text-lg font-black whitespace-nowrap text-emerald-700">{money(total * 1.15)}</td></tr>
          </tfoot>
        </table>
      </div>
      {canEdit && (
        <>
          <button onClick={() => setShowAll((s) => !s)} className="mt-2 text-xs font-semibold text-amber-700 hover:underline">
            {showAll ? "Mostrar solo ítems marcados" : "+ Agregar ítems del inventario"}
          </button>
          <label className="mt-4 block"><span className="label">Notas de la propuesta</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Condiciones, anticipo del 50 %, incluye transporte…" /></label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={pending || !selected.length} onClick={() => run(() => saveQuote(id, payload(), notes))} className="btn-dark">Guardar presupuesto</button>
            <button disabled={pending || !selected.length} onClick={() => run(async () => { const r = await saveQuote(id, payload(), notes); return r.ok ? sendQuote(id, true) : r; })} className="btn bg-[#25D366] text-white hover:bg-[#1fb957]">Guardar y enviar por WhatsApp</button>
            <button disabled={pending || !selected.length} onClick={() => run(async () => { const r = await saveQuote(id, payload(), notes); return r.ok ? sendQuote(id, false) : r; })} className="btn-ghost">Marcar como enviada</button>
            <a href={`/admin/solicitudes/${id}/cotizacion`} target="_blank" className="btn-ghost">🖨️ Imprimir / PDF</a>
          </div>
        </>
      )}
      {note}
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const { pending, run } = useAction();
  const [text, setText] = useState("");
  return (
    <form className="flex gap-2" action={() => run(() => addNote(id, text), () => setText(""))}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Agregar nota interna…" className="input" />
      <button disabled={pending || !text.trim()} className="btn-ghost">Agregar</button>
    </form>
  );
}
