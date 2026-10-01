"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/constants";
import { deleteTransferRule, saveAsset, saveTransferRule, toggleAsset, type ActionResult } from "../actions";

export interface AssetRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  totalStock: number;
  maintenanceUnits: number;
  dailyRate: number;
  description: string;
  specs: string;
  recommendedCapacity: string;
  imageUrl: string;
  specSheetUrl: string;
  publicVisible: boolean;
  active: boolean;
  peakReserved: number;
}

export interface RuleRow {
  id: string;
  canton: string;
  province: string;
  extraHours: number;
  note: string;
  lat: number | null;
  lng: number | null;
  covered: boolean;
}

function useRun() {
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
  return { pending, run, msg };
}

const EMPTY: Omit<AssetRow, "id" | "active" | "peakReserved"> = {
  name: "", category: "AUDIO", unit: "unidad", totalStock: 0, maintenanceUnits: 0, dailyRate: 0, description: "", specs: "", recommendedCapacity: "", imageUrl: "", specSheetUrl: "", publicVisible: true,
};

export function AssetTable({ assets, canEdit }: { assets: AssetRow[]; canEdit: boolean }) {
  const { pending, run, msg } = useRun();
  const [editing, setEditing] = useState<Partial<AssetRow> | null>(null);
  const [cat, setCat] = useState("TODOS");
  const [showInactive, setShowInactive] = useState(false);
  const list = assets.filter((a) => (cat === "TODOS" || a.category === cat) && (showInactive || a.active));

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <h2 className="mr-auto font-bold">Listado de activos</h2>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input w-auto py-1.5" aria-label="Categoría">
          <option value="TODOS">Todas las categorías</option>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Ver desactivados</label>
        {canEdit && <button onClick={() => setEditing({ ...EMPTY })} className="btn-dark py-1.5">+ Nuevo activo</button>}
      </div>
      {msg && <p className={`px-4 pt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Categoría</th>
              <th className="px-4 py-2 text-right">Stock total</th>
              <th className="px-4 py-2 text-right">En mantenimiento</th>
              <th className="px-4 py-2 text-right">Stock operativo</th>
              <th className="px-4 py-2 text-right" title="Máximo reservado en un mismo día durante los próximos 90 días">Pico reservado (90 d)</th>
              <th className="px-4 py-2 text-right">Tarifa/día</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const op = Math.max(0, a.totalStock - a.maintenanceUnits);
              const pct = op ? Math.round((a.peakReserved / op) * 100) : 0;
              return (
                <tr key={a.id} className={`border-b border-slate-100 ${a.active ? "" : "bg-slate-50 text-slate-400"}`}>
                  <td className="px-4 py-2.5 font-medium">{a.name} {!a.publicVisible && <span className="chip bg-slate-100 text-slate-500">interno</span>}</td>
                  <td className="px-4 py-2.5">{CATEGORIES[a.category as Category]?.short}</td>
                  <td className="px-4 py-2.5 text-right">{a.totalStock} <span className="text-xs text-slate-400">{a.unit}</span></td>
                  <td className="px-4 py-2.5 text-right">{a.maintenanceUnits > 0 ? <span className="text-amber-700">{a.maintenanceUnits}</span> : 0}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{op}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`chip ${pct >= 100 ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{a.peakReserved} · {pct}%</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">${a.dailyRate.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {canEdit && (
                      <>
                        <button onClick={() => setEditing(a)} className="mr-3 text-xs font-semibold text-amber-700 hover:underline">Editar</button>
                        <button disabled={pending} onClick={() => run(() => toggleAsset(a.id, !a.active))} className="text-xs font-semibold text-slate-500 hover:underline">
                          {a.active ? "Desactivar" : "Activar"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            action={(fd) => run(() => saveAsset(fd), () => setEditing(null))}
            className="my-8 grid w-full max-w-2xl gap-3 rounded-xl bg-white p-6 shadow-xl sm:grid-cols-2"
          >
            <h3 className="text-lg font-bold sm:col-span-2">{editing.id ? "Editar activo" : "Nuevo activo"}</h3>
            {editing.id && <input type="hidden" name="id" value={editing.id} />}
            <label className="sm:col-span-2"><span className="label">Nombre</span><input name="name" defaultValue={editing.name} required className="input" /></label>
            <label>
              <span className="label">Categoría</span>
              <select name="category" defaultValue={editing.category} className="input">
                {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
              </select>
            </label>
            <label><span className="label">Unidad</span><input name="unit" defaultValue={editing.unit} required className="input" placeholder="unidad, m², set…" /></label>
            <label><span className="label">Stock total</span><input name="totalStock" type="number" min={0} defaultValue={editing.totalStock} required className="input" /></label>
            <label><span className="label">Unidades en mantenimiento</span><input name="maintenanceUnits" type="number" min={0} defaultValue={editing.maintenanceUnits} required className="input" /></label>
            <label><span className="label">Tarifa referencial por día (USD)</span><input name="dailyRate" type="number" min={0} step="0.01" defaultValue={editing.dailyRate} className="input" /></label>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="publicVisible" defaultChecked={editing.publicVisible} /> Visible en catálogo público</label>
            <label className="sm:col-span-2"><span className="label">Descripción</span><input name="description" defaultValue={editing.description} className="input" /></label>
            <label className="sm:col-span-2"><span className="label">Ficha técnica (separar con “·”)</span><textarea name="specs" rows={2} defaultValue={editing.specs} className="input" /></label>
            <label className="sm:col-span-2"><span className="label">Dimensiones recomendadas según aforo</span><input name="recommendedCapacity" defaultValue={editing.recommendedCapacity} className="input" /></label>
            <label><span className="label">URL de foto</span><input name="imageUrl" defaultValue={editing.imageUrl} className="input" placeholder="https://…" /></label>
            <label><span className="label">URL ficha PDF (opcional)</span><input name="specSheetUrl" defaultValue={editing.specSheetUrl} className="input" placeholder="Se genera automáticamente si está vacío" /></label>
            <div className="flex gap-2 sm:col-span-2">
              <button disabled={pending} className="btn-dark">Guardar</button>
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export function TransferRules({ rules, canEdit }: { rules: RuleRow[]; canEdit: boolean }) {
  const { pending, run, msg } = useRun();
  const [editing, setEditing] = useState<Partial<RuleRow> | null>(null);
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div>
          <h2 className="font-bold">Reglas de traslado</h2>
          <p className="text-xs text-slate-500">Horas adicionales de bloqueo (antes y después del evento) por flete y desmontaje según destino.</p>
        </div>
        {canEdit && <button onClick={() => setEditing({ canton: "", province: "El Oro", extraHours: 0, note: "", lat: null, lng: null, covered: true })} className="btn-dark py-1.5">+ Regla</button>}
      </div>
      {msg && <p className={`px-4 pt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="px-4 py-2">Cantón / destino</th><th className="px-4 py-2">Provincia</th><th className="px-4 py-2 text-right">Horas extra</th><th className="px-4 py-2">Nota</th><th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium">{r.canton} {r.covered && r.lat != null && <span title="Aparece en el mapa de cobertura">📍</span>}</td>
                <td className="px-4 py-2">{r.province}</td>
                <td className="px-4 py-2 text-right font-bold">+{r.extraHours} h</td>
                <td className="px-4 py-2 text-xs text-slate-500">{r.note}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {canEdit && (
                    <>
                      <button onClick={() => setEditing(r)} className="mr-3 text-xs font-semibold text-amber-700 hover:underline">Editar</button>
                      <button disabled={pending} onClick={() => confirm(`¿Eliminar la regla de ${r.canton}?`) && run(() => deleteTransferRule(r.id))} className="text-xs font-semibold text-red-600 hover:underline">Eliminar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} action={(fd) => run(() => saveTransferRule(fd), () => setEditing(null))} className="grid w-full max-w-lg gap-3 rounded-xl bg-white p-6 shadow-xl sm:grid-cols-2">
            <h3 className="text-lg font-bold sm:col-span-2">{editing.id ? "Editar regla" : "Nueva regla de traslado"}</h3>
            {editing.id && <input type="hidden" name="id" value={editing.id} />}
            <label><span className="label">Cantón / destino</span><input name="canton" defaultValue={editing.canton} required className="input" /></label>
            <label><span className="label">Provincia</span><input name="province" defaultValue={editing.province} required className="input" /></label>
            <label><span className="label">Horas extra de bloqueo</span><input name="extraHours" type="number" min={0} defaultValue={editing.extraHours} required className="input" /></label>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="covered" defaultChecked={editing.covered} /> Mostrar en mapa de cobertura</label>
            <label><span className="label">Latitud</span><input name="lat" defaultValue={editing.lat ?? ""} className="input" /></label>
            <label><span className="label">Longitud</span><input name="lng" defaultValue={editing.lng ?? ""} className="input" /></label>
            <label className="sm:col-span-2"><span className="label">Nota</span><input name="note" defaultValue={editing.note} className="input" /></label>
            <div className="flex gap-2 sm:col-span-2"><button disabled={pending} className="btn-dark">Guardar</button><button type="button" onClick={() => setEditing(null)} className="btn-ghost">Cancelar</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
