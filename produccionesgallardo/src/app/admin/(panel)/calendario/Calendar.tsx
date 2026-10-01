"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface CalEvent {
  id: string;
  title: string;
  subtitle: string;
  start: string; // "YYYY-MM-DDTHH:MM" hora de Ecuador
  end: string;
  kind: "cita" | "montaje" | "evento" | "desmontaje";
  categories: string[];
  detail: string;
  href: string;
}

// Las fechas se manejan como "UTC ficticio" = hora local de Ecuador, para no depender de la zona del navegador.
const D = (s: string) => new Date(`${s.length === 10 ? `${s}T00:00` : s}:00Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const startOfWeek = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7)); // lunes
const hhmm = (d: Date) => d.toISOString().slice(11, 16);

const KIND: Record<CalEvent["kind"], { label: string; cls: string; bar: string }> = {
  cita: { label: "Cita de negociación", cls: "bg-blue-600 text-white", bar: "bg-blue-600" },
  montaje: { label: "Montaje / traslado", cls: "bg-orange-400 text-white", bar: "bg-orange-400" },
  evento: { label: "Evento confirmado", cls: "bg-red-600 text-white", bar: "bg-red-600" },
  desmontaje: { label: "Desmontaje / retorno", cls: "bg-orange-300 text-orange-950", bar: "bg-orange-300" },
};

const FILTERS = [
  { key: "TODOS", label: "Todo" },
  { key: "BANDA", label: "Solo Banda" },
  { key: "ESTRUCTURAS", label: "Solo Tarimas" },
  { key: "AUDIO", label: "Solo Audio" },
  { key: "VIDEO_LED", label: "Solo Pantallas LED" },
];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOUR_PX = 36;

export function Calendar({ events, today }: { events: CalEvent[]; today: string }) {
  const [view, setView] = useState<"mes" | "semana" | "dia">("mes");
  const [cursor, setCursor] = useState(D(today));
  const [filter, setFilter] = useState("TODOS");
  const [selected, setSelected] = useState<CalEvent | null>(null);

  const visible = useMemo(
    () => (filter === "TODOS" ? events : events.filter((e) => e.kind !== "cita" && e.categories.includes(filter))),
    [events, filter],
  );
  const onDay = (day: Date) => {
    const s = day.getTime();
    const e = s + 86_400_000;
    return visible.filter((ev) => D(ev.start).getTime() < e && D(ev.end).getTime() > s);
  };

  const move = (dir: number) => {
    if (view === "mes") setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + dir, 1)));
    else setCursor(addDays(cursor, dir * (view === "semana" ? 7 : 1)));
  };

  const title =
    view === "mes"
      ? `${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`
      : view === "semana"
        ? `Semana del ${startOfWeek(cursor).getUTCDate()} de ${MONTHS[startOfWeek(cursor).getUTCMonth()]}`
        : `${WD[(cursor.getUTCDay() + 6) % 7]} ${cursor.getUTCDate()} de ${MONTHS[cursor.getUTCMonth()]}`;

  const chip = (ev: CalEvent, compact = false) => (
    <button
      key={ev.id}
      onClick={() => setSelected(ev)}
      title={`${KIND[ev.kind].label}: ${ev.title}`}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${KIND[ev.kind].cls}`}
    >
      {!compact && ev.kind === "cita" && `${hhmm(D(ev.start))} `}
      {ev.title}
    </button>
  );

  const timeGrid = (days: Date[]) => (
    <div className="overflow-x-auto">
      <div className="grid min-w-[700px]" style={{ gridTemplateColumns: `50px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={key(d)} className={`border-b border-slate-200 p-2 text-center text-xs font-semibold ${key(d) === today ? "text-amber-600" : "text-slate-600"}`}>
            {WD[(d.getUTCDay() + 6) % 7]} {d.getUTCDate()}
          </div>
        ))}
        <div className="relative" style={{ height: 24 * HOUR_PX }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="absolute right-1 text-[10px] text-slate-400" style={{ top: h * HOUR_PX - 6 }}>{h > 0 && `${String(h).padStart(2, "0")}:00`}</div>
          ))}
        </div>
        {days.map((d) => {
          const s = d.getTime();
          const evs = onDay(d);
          return (
            <div key={key(d)} className="relative border-l border-slate-100" style={{ height: 24 * HOUR_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: h * HOUR_PX }} />
              ))}
              {evs.map((ev, i) => {
                const top = Math.max(0, (D(ev.start).getTime() - s) / 3_600_000);
                const bottom = Math.min(24, (D(ev.end).getTime() - s) / 3_600_000);
                const cols = Math.min(evs.length, 3);
                return (
                  <button
                    key={ev.id}
                    onClick={() => setSelected(ev)}
                    className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm ${KIND[ev.kind].cls}`}
                    style={{ top: top * HOUR_PX, height: Math.max(18, (bottom - top) * HOUR_PX - 2), left: `${((i % cols) / cols) * 100}%`, width: `${100 / cols}%` }}
                  >
                    <strong className="block truncate">{ev.title}</strong>
                    <span className="block truncate opacity-90">{ev.subtitle}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (view === "mes") {
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const gridStart = startOfWeek(first);
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    body = (
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-slate-200 gap-px">
        {WD.map((w) => (
          <div key={w} className="bg-slate-50 p-2 text-center text-xs font-semibold text-slate-500">{w}</div>
        ))}
        {days.map((d) => {
          const evs = onDay(d);
          const inMonth = d.getUTCMonth() === cursor.getUTCMonth();
          return (
            <div key={key(d)} className={`min-h-24 space-y-0.5 bg-white p-1 sm:min-h-28 ${inMonth ? "" : "bg-slate-50 opacity-50"}`}>
              <button
                onClick={() => {
                  setCursor(d);
                  setView("dia");
                }}
                className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold hover:bg-slate-100 ${key(d) === today ? "bg-amber-500 text-white" : "text-slate-600"}`}
              >
                {d.getUTCDate()}
              </button>
              {evs.slice(0, 3).map((ev) => chip(ev, true))}
              {evs.length > 3 && (
                <button onClick={() => { setCursor(d); setView("dia"); }} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800">
                  +{evs.length - 3} más
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  } else if (view === "semana") {
    const ws = startOfWeek(cursor);
    body = timeGrid(Array.from({ length: 7 }, (_, i) => addDays(ws, i)));
  } else {
    body = timeGrid([cursor]);
  }

  return (
    <div className="card p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} className="btn-ghost px-3 py-1.5" aria-label="Anterior">‹</button>
          <button onClick={() => setCursor(D(today))} className="btn-ghost px-3 py-1.5">Hoy</button>
          <button onClick={() => move(1)} className="btn-ghost px-3 py-1.5" aria-label="Siguiente">›</button>
        </div>
        <h2 className="text-lg font-bold capitalize">{title}</h2>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          {(["mes", "semana", "dia"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 font-semibold capitalize ${view === v ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {v === "dia" ? "Día" : v}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase">Filtro de disponibilidad:</span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f.key ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-500">
          {(Object.keys(KIND) as CalEvent["kind"][]).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${KIND[k].bar}`} />{KIND[k].label}</span>
          ))}
        </div>
      </div>
      {body}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <span className={`chip ${KIND[selected.kind].cls}`}>{KIND[selected.kind].label}</span>
            <h3 className="mt-2 text-lg font-bold">{selected.title}</h3>
            <p className="text-sm text-slate-500">{selected.subtitle}</p>
            <p className="mt-3 text-sm">
              {selected.start.replace("T", " ")} → {selected.end.replace("T", " ")}
            </p>
            {selected.detail && <p className="mt-3 text-sm whitespace-pre-line text-slate-600">{selected.detail}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="btn-ghost">Cerrar</button>
              <Link href={selected.href} className="btn-dark">Ver expediente</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
