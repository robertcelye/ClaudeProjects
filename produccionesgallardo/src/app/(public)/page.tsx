import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CoverageMap } from "@/components/CoverageMap";

const PILLARS = [
  {
    cat: "AUDIO",
    title: "Audio Profesional",
    icon: "🔊",
    points: ["Sistemas Line Array", "Microfonía inalámbrica", "Consolas digitales"],
    gradient: "from-sky-500/30 to-sky-500/0",
  },
  {
    cat: "VIDEO_LED",
    title: "Pantallas LED",
    icon: "🖥️",
    points: ["Módulos P3.9 exterior", "Módulos P2.6 interior", "Procesadores de video"],
    gradient: "from-violet-500/30 to-violet-500/0",
  },
  {
    cat: "ESTRUCTURAS",
    title: "Tarimas y Estructuras",
    icon: "🏗️",
    points: ["Sistemas modulares certificados", "Techados truss", "Pasarelas"],
    gradient: "from-amber-500/30 to-amber-500/0",
  },
  {
    cat: "BANDA",
    title: "Banda en Vivo",
    icon: "🎺",
    points: ["Muestras de audio y video", "Repertorio versátil", "Acústico · Completa · Orquesta show"],
    gradient: "from-rose-500/30 to-rose-500/0",
  },
];

export default async function Home() {
  await connection();
  const [settings, rules, brands, eventsDone] = await Promise.all([
    getSettings(),
    prisma.transferRule.findMany({ where: { covered: true, lat: { not: null }, lng: { not: null } }, orderBy: { extraHours: "asc" } }),
    prisma.brand.findMany({ orderBy: { order: "asc" } }),
    prisma.request.count({ where: { status: { in: ["CONFIRMADO", "FINALIZADO"] } } }),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[88vh] items-center overflow-hidden">
        {settings.heroVideoUrl ? (
          <video className="absolute inset-0 -z-20 h-full w-full object-cover" src={settings.heroVideoUrl} autoPlay muted loop playsInline preload="metadata" />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 -z-20 animate-pan bg-[length:200%_200%] bg-[radial-gradient(ellipse_at_20%_10%,#f5b30155,transparent_45%),radial-gradient(ellipse_at_80%_0%,#7c3aed55,transparent_40%),radial-gradient(ellipse_at_50%_100%,#0ea5e944,transparent_50%),linear-gradient(120deg,#07070a,#15151d,#07070a)]"
          />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/50 via-ink-950/60 to-ink-950" />
        <div className="mx-auto w-full max-w-7xl px-4 py-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-gold-300 uppercase">
            Infraestructura 100 % propia · Sin intermediarios
          </p>
          <h1 className="max-w-4xl text-4xl leading-[1.05] font-black tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Producimos tu evento <span className="text-gold-500">de principio a fin</span> con equipo propio.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/75">
            Audio line array, pantallas LED, tarimas certificadas y nuestra propia banda en vivo. Montajes para bodas, conciertos, eventos corporativos y festivales masivos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {["📍 Machala", "🗺️ Toda la provincia de El Oro", "🇪🇨 Cobertura nacional"].map((b) => (
              <span key={b} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/85 backdrop-blur">
                {b}
              </span>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/cotizar" className="btn-gold px-7 py-4 text-base shadow-[0_0_40px_-8px_#f5b301]">
              Cotizar y Agendar Cita →
            </Link>
            <Link href="/catalogo" className="btn-ghost px-7 py-4 text-base">
              Ver catálogo técnico
            </Link>
          </div>
        </div>
      </section>

      {/* Pilares */}
      <section id="soluciones" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-black sm:text-4xl">Solución integral, un solo proveedor</h2>
          <p className="mt-3 text-white/65">Cuatro pilares técnicos propios, coordinados por un mismo equipo de producción.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <Link
              key={p.cat}
              href={`/catalogo?cat=${p.cat}`}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-ink-800 p-6 transition duration-300 hover:-translate-y-1 hover:border-gold-500/60"
            >
              <div className={`absolute inset-0 -z-0 bg-gradient-to-b ${p.gradient} opacity-60 transition group-hover:opacity-100`} />
              <div className="relative">
                <span className="text-4xl">{p.icon}</span>
                <h3 className="mt-4 text-xl font-bold">{p.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-white/70">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-2">
                      <span className="text-gold-500">▸</span>
                      {pt}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm font-semibold text-gold-400 opacity-0 transition group-hover:opacity-100">Ver especificaciones →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Prueba social y cobertura */}
      <section id="cobertura" className="scroll-mt-20 border-y border-white/10 bg-ink-900">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black sm:text-4xl">Nos respaldan quienes producen en grande</h2>
            <p className="mt-3 text-white/65">Instituciones, marcas y familias que confiaron su evento a nuestro equipo técnico.</p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {brands.map((b) => (
                <div key={b.id} className="flex h-20 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-sm font-semibold text-white/70 grayscale transition hover:border-gold-500/40 hover:text-white hover:grayscale-0">
                  {b.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logoUrl} alt={b.name} className="max-h-12 max-w-full object-contain" />
                  ) : (
                    b.name
                  )}
                </div>
              ))}
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 text-center">
              {[
                [`${Math.max(eventsDone, 1)}+`, "eventos producidos"],
                [`${rules.length}`, "cantones atendidos"],
                ["100 %", "equipo propio"],
              ].map(([n, l]) => (
                <div key={l} className="rounded-xl bg-white/[0.03] p-4">
                  <dt className="text-3xl font-black text-gold-500">{n}</dt>
                  <dd className="mt-1 text-xs text-white/60 uppercase">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-2xl border border-white/10 bg-ink-800 p-6">
            <h3 className="font-bold">Cobertura en El Oro</h3>
            <p className="mb-4 text-sm text-white/60">Base de operaciones en Machala. Pasa el cursor por un cantón para ver el tiempo de traslado.</p>
            <CoverageMap points={rules.map((r) => ({ canton: r.canton, lat: r.lat!, lng: r.lng!, extraHours: r.extraHours }))} />
            <p className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
              {rules.map((r) => (
                <span key={r.id} className="rounded-full bg-white/5 px-2 py-1">{r.canton}</span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-3xl font-black sm:text-4xl">¿Listo para cotizar tu evento?</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/65">Completa el formulario en 2 minutos y nuestro asistente te escribirá por WhatsApp para agendar la reunión técnica.</p>
        <Link href="/cotizar" className="btn-gold mt-8 px-8 py-4 text-base">Cotizar y Agendar Cita →</Link>
      </section>
    </>
  );
}
