import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/components/Logo";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/phone";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const s = await getSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Inicio">
            <Logo className="text-sm sm:text-base" />
          </Link>
          <div className="flex items-center gap-1 text-sm sm:gap-4">
            <Link href="/#soluciones" className="hidden px-2 py-1 text-white/75 hover:text-white md:block">Soluciones</Link>
            <Link href="/catalogo" className="px-2 py-1 text-white/75 hover:text-white">Catálogo</Link>
            <Link href="/#cobertura" className="hidden px-2 py-1 text-white/75 hover:text-white md:block">Cobertura</Link>
            <Link href="/cotizar" className="btn-gold px-3 py-2">Cotizar y Agendar</Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="no-print border-t border-white/10 bg-ink-900">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-white/60 md:grid-cols-3">
          <div>
            <Logo className="text-white" />
            <p className="mt-3 max-w-xs">Dueños directos de toda la infraestructura técnica. Sin intermediarios. Machala · El Oro · Ecuador.</p>
          </div>
          <div>
            <p className="font-semibold text-white">Contacto</p>
            <p className="mt-2">WhatsApp: <a className="hover:text-gold-400" href={waLink(s.businessWhatsapp)}>{s.businessWhatsapp}</a></p>
            <p>Correo: <a className="hover:text-gold-400" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></p>
          </div>
          <div>
            <p className="font-semibold text-white">Accesos</p>
            <p className="mt-2"><Link className="hover:text-gold-400" href="/catalogo">Catálogo técnico</Link></p>
            <p><Link className="hover:text-gold-400" href="/admin">Panel administrativo</Link></p>
          </div>
        </div>
        <p className="pb-6 text-center text-xs text-white/35">© {new Date().getFullYear()} {s.companyName}. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
