import { STATUSES } from "@/lib/constants";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  NUEVO: "bg-sky-100 text-sky-800",
  IA_RESPONDIDO: "bg-indigo-100 text-indigo-800",
  CITA_AGENDADA: "bg-blue-100 text-blue-800",
  COTIZACION_ENVIADA: "bg-amber-100 text-amber-800",
  CONFIRMADO: "bg-emerald-100 text-emerald-800",
  FINALIZADO: "bg-slate-200 text-slate-700",
  CANCELADO: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`chip ${STATUS_STYLE[status] ?? "bg-slate-100"}`}>{STATUSES[status as keyof typeof STATUSES] ?? status}</span>;
}
