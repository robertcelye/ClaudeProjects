"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { PIPELINE, pipelineColumn } from "@/lib/constants";
import { StatusBadge } from "@/components/admin";
import { changeStatus } from "../actions";

export interface Card {
  id: string;
  ticket: string;
  client: string;
  eventType: string;
  eventDate: string;
  canton: string;
  status: string;
  quoteTotal: number | null;
  aiActive: boolean;
  nextAppointment: string | null;
  itemsCount: number;
}

export function Kanban({ initial }: { initial: Card[] }) {
  const [cards, setCards] = useState(initial);
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; warn?: boolean } | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? cards.filter((c) => `${c.client} ${c.ticket} ${c.canton} ${c.eventType}`.toLowerCase().includes(s)) : cards;
  }, [cards, q]);

  function move(id: string, status: string) {
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    startTransition(async () => {
      const res = await changeStatus(id, status);
      if (!res.ok) {
        setCards(prev);
        setToast({ text: res.message ?? "No se pudo mover", warn: true });
      } else if (res.message) setToast({ text: res.message, warn: true });
      else setToast({ text: status === "CONFIRMADO" ? "Confirmado: inventario bloqueado automáticamente" : "Estado actualizado" });
      setTimeout(() => setToast(null), 6000);
    });
  }

  function drop(column: string) {
    setOver(null);
    if (!dragId) return;
    const card = cards.find((c) => c.id === dragId);
    setDragId(null);
    if (!card || pipelineColumn(card.status) === column) return;
    if (column === "CERRADO") setClosing(card.id);
    else move(card.id, column);
  }

  const money = (n: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, ticket o cantón…" className="input max-w-xs" />
        <p className="text-xs text-slate-500">Arrastra las tarjetas entre columnas. Al soltar en <strong>Confirmado</strong> se bloquea el inventario.</p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE.map((col) => {
          const list = filtered.filter((c) => pipelineColumn(c.status) === col.key);
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={() => drop(col.key)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border-2 bg-slate-100/80 transition ${over === col.key ? "border-amber-400 bg-amber-50" : "border-transparent"}`}
            >
              <header className="px-3 pt-3 pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-800">{col.label}</h2>
                  <span className="chip bg-white text-slate-600">{list.length}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{col.hint}</p>
              </header>
              <div className="flex min-h-32 flex-1 flex-col gap-2 p-2">
                {list.map((c) => (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ${dragId === c.id ? "opacity-40" : "hover:shadow-md"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/admin/solicitudes/${c.id}`} className="font-semibold text-slate-900 hover:text-amber-700">{c.client}</Link>
                      {c.aiActive && <span title="Asistente IA activo" className="chip bg-indigo-100 text-indigo-700">IA</span>}
                    </div>
                    <p className="font-mono text-[11px] text-slate-400">{c.ticket}</p>
                    <p className="mt-2 text-xs text-slate-600">{c.eventType} · {c.canton}</p>
                    <p className="text-xs text-slate-600">📅 {c.eventDate}</p>
                    {c.nextAppointment && <p className="text-xs text-blue-700">🗓️ Cita: {c.nextAppointment}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{c.itemsCount} ítems</span>
                      {c.quoteTotal != null && <span className="text-sm font-bold text-emerald-700">{money(c.quoteTotal)}</span>}
                    </div>
                    {col.key === "CERRADO" && <div className="mt-2"><StatusBadge status={c.status} /></div>}
                    {/* Alternativa accesible al arrastre */}
                    <select
                      aria-label="Mover a"
                      className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[11px] text-slate-500"
                      value=""
                      onChange={(e) => (e.target.value === "CERRADO" ? setClosing(c.id) : move(c.id, e.target.value))}
                    >
                      <option value="">Mover a…</option>
                      {PIPELINE.filter((p) => p.key !== pipelineColumn(c.status)).map((p) => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setClosing(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="font-bold">Cerrar solicitud</h3>
            <p className="mt-1 text-sm text-slate-500">¿El evento se ejecutó o la propuesta fue descartada?</p>
            <div className="mt-4 flex gap-2">
              <button className="btn-dark flex-1" onClick={() => { move(closing, "FINALIZADO"); setClosing(null); }}>Finalizado</button>
              <button className="btn-danger flex-1" onClick={() => { move(closing, "CANCELADO"); setClosing(null); }}>Cancelado</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div role="status" className={`fixed right-4 bottom-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${toast.warn ? "bg-amber-500 text-white" : "bg-slate-900 text-white"}`}>
          {toast.text}
        </div>
      )}
    </>
  );
}
