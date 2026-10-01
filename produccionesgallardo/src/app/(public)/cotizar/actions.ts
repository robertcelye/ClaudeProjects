"use server";

import { after } from "next/server";
import { createLead, leadSchema, processNewLead, type LeadInput } from "@/lib/leads";

export type SubmitResult = { ok: true; ticket: string } | { ok: false; errors: Record<string, string> };

export async function submitLead(input: LeadInput): Promise<SubmitResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, errors };
  }
  const request = await createLead(parsed.data);
  // Webhook + primer mensaje del agente IA, sin bloquear la respuesta al cliente.
  after(() => processNewLead(request.id).catch((e) => console.error("[lead] error en flujo automático", e)));
  return { ok: true, ticket: request.ticket };
}
