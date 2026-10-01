"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Correo</span>
        <input name="email" type="email" required autoComplete="username" className="input" />
      </label>
      <label className="block">
        <span className="label">Contraseña</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={pending} className="btn-gold w-full">{pending ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
