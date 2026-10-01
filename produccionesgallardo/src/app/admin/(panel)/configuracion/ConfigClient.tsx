"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ROLES } from "@/lib/constants";
import { createUser, updateSettings, updateUser, type ActionResult } from "../actions";

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
  const note = msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>;
  return { pending, run, note };
}

export function SettingsForm({ children, submitLabel = "Guardar cambios" }: { children: React.ReactNode; submitLabel?: string }) {
  const { pending, run, note } = useRun();
  return (
    <form action={(fd) => run(() => updateSettings(fd))} className="space-y-4">
      {children}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-dark">{pending ? "Guardando…" : submitLabel}</button>
        {note}
      </div>
    </form>
  );
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export function UsersManager({ users, meId }: { users: UserRow[]; meId: string }) {
  const { pending, run, note } = useRun();
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="py-2">Nombre</th><th className="py-2">Correo</th><th className="py-2">Rol</th><th className="py-2">Estado</th><th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-slate-100 ${u.active ? "" : "text-slate-400"}`}>
                <td className="py-2 font-medium">{u.name}{u.id === meId && " (tú)"}</td>
                <td className="py-2">{u.email}</td>
                <td className="py-2">
                  <select
                    aria-label={`Rol de ${u.name}`}
                    defaultValue={u.role}
                    key={u.role}
                    disabled={pending || u.id === meId}
                    onChange={(e) => run(() => updateUser(u.id, { role: e.target.value }))}
                    className="input w-auto py-1"
                  >
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="py-2">{u.active ? <span className="chip bg-emerald-100 text-emerald-700">Activo</span> : <span className="chip bg-slate-100">Inactivo</span>}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <button
                    disabled={pending}
                    onClick={() => {
                      const p = prompt(`Nueva contraseña para ${u.name} (mín. 8 caracteres):`);
                      if (p) run(() => updateUser(u.id, { password: p }));
                    }}
                    className="mr-3 text-xs font-semibold text-amber-700 hover:underline"
                  >
                    Restablecer clave
                  </button>
                  {u.id !== meId && (
                    <button disabled={pending} onClick={() => run(() => updateUser(u.id, { active: !u.active }))} className="text-xs font-semibold text-slate-500 hover:underline">
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? (
        <form action={(fd) => run(() => createUser(fd), () => setAdding(false))} className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <label><span className="label">Nombre</span><input name="name" required className="input" /></label>
          <label><span className="label">Correo</span><input name="email" type="email" required className="input" /></label>
          <label>
            <span className="label">Rol</span>
            <select name="role" className="input">{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <label><span className="label">Contraseña inicial</span><input name="password" type="password" minLength={8} required className="input" /></label>
          <div className="flex gap-2"><button disabled={pending} className="btn-dark">Crear usuario</button><button type="button" onClick={() => setAdding(false)} className="btn-ghost">Cancelar</button></div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-4 text-sm font-semibold text-amber-700 hover:underline">+ Nuevo usuario</button>
      )}
      <div className="mt-2">{note}</div>
    </div>
  );
}
