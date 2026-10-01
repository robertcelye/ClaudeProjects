import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can, ROLES } from "@/lib/constants";
import { Logo } from "@/components/Logo";
import { logout } from "../login/actions";
import { Nav } from "./Nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = [
    { href: "/admin", label: "Tablero", icon: "📊", perm: "dashboard" as const },
    { href: "/admin/calendario", label: "Calendario", icon: "📅", perm: "calendario" as const },
    { href: "/admin/crm", label: "CRM Solicitudes", icon: "🗂️", perm: "crm" as const },
    { href: "/admin/inventario", label: "Inventario", icon: "🎛️", perm: "inventario" as const },
    { href: "/admin/configuracion", label: "Configuración", icon: "⚙️", perm: "configuracion" as const },
  ].filter((i) => can(user.role, i.perm));

  return (
    <div className="admin-surface min-h-screen lg:flex">
      <aside className="no-print bg-ink-950 p-3 text-white lg:sticky lg:top-0 lg:flex lg:self-start lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:p-4">
        <div className="mb-3 flex items-center justify-between lg:mb-8">
          <Link href="/admin"><Logo className="text-[11px]" /></Link>
        </div>
        <Nav items={items} />
        <div className="mt-3 hidden border-t border-white/10 pt-4 text-sm lg:mt-auto lg:block">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-white/50">{ROLES[user.role]}</p>
          <div className="mt-3 flex gap-3 text-xs">
            <Link href="/" className="text-white/60 hover:text-white">Ver sitio ↗</Link>
            <form action={logout}><button className="text-white/60 hover:text-white">Cerrar sesión</button></form>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="no-print flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs lg:hidden">
          <span>{user.name} · {ROLES[user.role]}</span>
          <form action={logout}><button className="font-semibold text-slate-600">Salir</button></form>
        </div>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
