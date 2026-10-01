import { listFromText, type Settings } from "./settings";
import { sendText } from "./whatsapp";

/** Alerta interna a los números configurados (Vista 10 · Parámetros de Notificación). */
export async function notifyTeam(settings: Settings, text: string) {
  const numbers = listFromText(settings.notificationNumbers);
  await Promise.all(numbers.map((n) => sendText(n, text)));
}
