"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/constants";
import type { BandFormat } from "@/lib/settings";
import { embedUrl } from "@/components/media";

export interface PublicAsset {
  id: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  specs: string;
  imageUrl: string | null;
  specSheetUrl: string | null;
  recommendedCapacity: string;
}

const ICON: Record<Category, string> = { AUDIO: "🔊", VIDEO_LED: "🖥️", ESTRUCTURAS: "🏗️", BANDA: "🎺" };

export function CatalogBrowser({ assets, initial, bandFormats }: { assets: PublicAsset[]; initial: string; bandFormats: BandFormat[] }) {
  const [filter, setFilter] = useState<string>(CATEGORY_KEYS.includes(initial as Category) ? initial : "TODOS");
  const [open, setOpen] = useState<PublicAsset | null>(null);
  const list = filter === "TODOS" ? assets : assets.filter((a) => a.category === filter);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por categoría">
        {["TODOS", ...CATEGORY_KEYS].map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === k ? "border-gold-500 bg-gold-500 text-ink-950" : "border-white/15 text-white/75 hover:border-white/40"
            }`}
          >
            {k === "TODOS" ? "Todos" : CATEGORIES[k as Category].short}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <button
            key={a.id}
            onClick={() => setOpen(a)}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-ink-800 text-left transition hover:-translate-y-0.5 hover:border-gold-500/60"
          >
            <div className="relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900 text-6xl">
              {a.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.imageUrl} alt={a.name} className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden>{ICON[a.category as Category]}</span>
              )}
              <span className="absolute top-3 left-3 rounded-full bg-ink-950/80 px-2.5 py-1 text-xs font-semibold text-gold-300">
                {CATEGORIES[a.category as Category]?.short}
              </span>
            </div>
            <div className="p-5">
              <h3 className="font-bold group-hover:text-gold-300">{a.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-white/60">{a.description}</p>
              {a.recommendedCapacity && <p className="mt-3 text-xs text-white/45">👥 {a.recommendedCapacity}</p>}
            </div>
          </button>
        ))}
      </div>

      {(filter === "TODOS" || filter === "BANDA") && <BandArea formats={bandFormats} />}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ficha-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/10 bg-ink-800 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex aspect-[21/9] items-center justify-center bg-gradient-to-br from-ink-700 to-ink-900 text-7xl">
              {open.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={open.imageUrl} alt={open.name} className="h-full w-full object-cover" />
              ) : (
                ICON[open.category as Category]
              )}
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 id="ficha-title" className="text-2xl font-black">{open.name}</h2>
                <button onClick={() => setOpen(null)} className="rounded-lg px-2 text-2xl text-white/50 hover:text-white" aria-label="Cerrar">×</button>
              </div>
              <p className="mt-2 text-white/70">{open.description}</p>
              <h3 className="mt-6 text-xs font-bold tracking-wider text-gold-400 uppercase">Ficha técnica</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-white/80">
                {open.specs.split("·").map((s) => (
                  <li key={s} className="flex gap-2"><span className="text-gold-500">▸</span>{s.trim()}</li>
                ))}
              </ul>
              {open.recommendedCapacity && (
                <>
                  <h3 className="mt-6 text-xs font-bold tracking-wider text-gold-400 uppercase">Dimensiones recomendadas según aforo</h3>
                  <p className="mt-2 text-sm text-white/80">{open.recommendedCapacity}</p>
                </>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={open.specSheetUrl || `/catalogo/ficha/${open.id}`} target="_blank" rel="noreferrer" className="btn-ghost">⬇ Ficha técnica PDF</a>
                <Link href={`/cotizar?equipo=${open.id}`} className="btn-gold">Incluir en mi cotización →</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BandArea({ formats }: { formats: BandFormat[] }) {
  const [i, setI] = useState(0);
  if (!formats.length) return null;
  const f = formats[Math.min(i, formats.length - 1)];
  const embed = f.videoUrl ? embedUrl(f.videoUrl) : null;
  return (
    <section className="mt-16 rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-transparent p-6 sm:p-8">
      <h2 className="text-2xl font-black">🎺 Área multimedia de la banda</h2>
      <p className="mt-1 text-sm text-white/60">Escucha y mira muestras en vivo de cada configuración.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {formats.map((b, idx) => (
          <button
            key={b.name}
            onClick={() => setI(idx)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${idx === i ? "bg-rose-500 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
          >
            {b.name}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="overflow-hidden rounded-xl bg-black">
          {embed ? (
            <iframe className="aspect-video w-full" src={embed} title={f.name} allow="encrypted-media; picture-in-picture" allowFullScreen />
          ) : f.videoUrl ? (
            <video className="aspect-video w-full" src={f.videoUrl} controls preload="metadata" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-white/40">Video de muestra próximamente</div>
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold">{f.name}</h3>
          <p className="text-sm text-rose-300">{f.members}</p>
          <p className="mt-3 text-white/75">{f.description}</p>
          {f.audioUrl && <audio className="mt-5 w-full" src={f.audioUrl} controls preload="none" />}
          <Link href="/cotizar" className="btn-gold mt-6">Cotizar la banda →</Link>
        </div>
      </div>
    </section>
  );
}
