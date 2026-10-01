"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/feed";

const ROLE: Record<string, { label: string; cls: string }> = {
  AGENT: { label: "IA", cls: "bg-indigo-100 text-indigo-700" },
  CLIENT: { label: "Cliente", cls: "bg-emerald-100 text-emerald-700" },
  HUMAN: { label: "Asesor", cls: "bg-amber-100 text-amber-800" },
  SYSTEM: { label: "Sistema", cls: "bg-slate-100 text-slate-600" },
};

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export function LiveFeed({ initial }: { initial: FeedItem[] }) {
  const [items, setItems] = useState(initial);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/feed", { cache: "no-store" });
        if (res.ok) setItems(await res.json());
      } catch {}
      tick((t) => t + 1);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  if (!items.length) return <p className="p-5 text-sm text-slate-500">Sin interacciones todavía.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((m) => (
        <li key={m.id}>
          <Link href={`/admin/solicitudes/${m.requestId}`} className="block px-5 py-3 hover:bg-slate-50">
            <div className="flex items-center gap-2 text-xs">
              <span className={`chip ${ROLE[m.role]?.cls}`}>{ROLE[m.role]?.label ?? m.role}</span>
              <span className="font-semibold text-slate-800">{m.clientName}</span>
              <span className="text-slate-400">{m.ticket}</span>
              <span className="ml-auto text-slate-400">{ago(m.createdAt)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{m.content}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
