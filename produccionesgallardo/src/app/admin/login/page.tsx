import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingreso al panel" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#f5b30122,transparent_60%)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-800 p-8">
        <Logo className="text-sm" />
        <h1 className="mt-6 text-xl font-bold">Panel administrativo</h1>
        <p className="mb-6 text-sm text-white/55">Ingresa con tu cuenta del equipo.</p>
        <LoginForm />
      </div>
    </div>
  );
}
