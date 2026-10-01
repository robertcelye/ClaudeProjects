# Plataforma web — Producciones Gallardo

Implementación de la propuesta técnica (8 de septiembre de 2026): **portal público** de captación y agendamiento + **panel administrativo** operativo, con agente IA de calificación por WhatsApp.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma (SQLite en desarrollo / PostgreSQL en producción) · Claude API (`@anthropic-ai/sdk`) · WhatsApp Business Cloud API.

## Puesta en marcha

```bash
cd produccionesgallardo
cp .env.example .env      # complete AUTH_SECRET (y opcionalmente las claves de IA/WhatsApp)
npm install
npm run setup             # crea la BD y carga datos de ejemplo
npm run dev               # http://localhost:3000
```

Usuarios de prueba (semilla):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@produccionesgallardo.com | Admin123! |
| Ventas | ventas@produccionesgallardo.com | Ventas123! |
| Logística | logistica@produccionesgallardo.com | Logistica123! |

Otros comandos: `npm test` (pruebas unitarias), `npm run lint`, `npm run typecheck`, `npm run build`.

## Mapa de vistas

| # | Vista | Ruta |
|---|---|---|
| 1 | Landing (hero con video reel, 4 pilares, marcas, mapa de cobertura) | `/` |
| 2 | Catálogo técnico, ficha (modal + PDF imprimible) y área multimedia de la banda | `/catalogo`, `/catalogo/ficha/[id]` |
| 3 | Solicitud multi-paso (logística → equipos → descripción → contacto +593) | `/cotizar` |
| 4 | Confirmación con ticket, aviso de WhatsApp y enlace pre-cargado | `/cotizar/confirmacion/[ticket]` |
| 5 | Tablero: KPIs, alertas de stock, feed en tiempo real del agente IA | `/admin` |
| 6 | Calendario maestro (mes/semana/día, citas en azul, bloqueos en rojo/naranja, filtro por recurso) | `/admin/calendario` |
| 7 | CRM Kanban con arrastrar y soltar (Confirmado bloquea inventario) | `/admin/crm` |
| 8 | Expediente: ficha del prospecto, pedido vs. bodega, log de IA, presupuesto rápido | `/admin/solicitudes/[id]` |
| 9 | Inventario (CRUD de activos) y reglas de traslado | `/admin/inventario` |
| 10 | Configuración del agente IA, notificaciones, agenda, portal y accesos por rol | `/admin/configuracion` |

## Cómo funciona

**Flujo de un lead.** El formulario crea la solicitud (ticket `PG-AAMM-XXXX`) y responde de inmediato. En segundo plano (`after()`): se dispara el webhook externo opcional (n8n/Make/Zapier), se envía la plantilla de WhatsApp de apertura si está configurada y el agente IA escribe el primer mensaje → la solicitud pasa a **IA Respondido**.

**Agente IA** (`src/lib/agent.ts`). Usa Claude con el prompt, las preguntas de calificación y los enlaces editables en la Vista 10. Recibe el contexto de la solicitud y los horarios libres, y dispone de dos herramientas:

- `agendar_reunion`: crea la cita (solo en un horario libre real) → **Cita Agendada**.
- `transferir_a_asesor`: pausa la IA y, si el cliente está calificado, envía una alerta a los números de notificación.

Sin `ANTHROPIC_API_KEY`, responde con plantillas de respaldo para que el flujo siga funcionando. Desde el expediente, un administrador puede **simular mensajes del cliente** para probar el agente sin WhatsApp.

**WhatsApp.** Registre en Meta el webhook `https://SU-DOMINIO/api/whatsapp/webhook` con `WHATSAPP_VERIFY_TOKEN`. Los mensajes entrantes se asocian al cliente por número y continúan la conversación. Fuera de la ventana de 24 h, Meta exige una plantilla aprobada (`WHATSAPP_TEMPLATE_NAME`) para el primer contacto. Sin credenciales, todo queda registrado en el log como «simulado».

**Validador de disponibilidad** (`src/lib/availability.ts`). Al confirmar una solicitud se calcula su bloqueo logístico:

```
[montaje − horas de traslado]  →  evento  →  [fin + desmontaje + horas de traslado]
```

Las horas de traslado vienen de las reglas por cantón (p. ej. +12 h para Piñas o Zaruma). El stock operativo es el stock total menos las unidades en mantenimiento. Las reservas usan los ítems del presupuesto si existen y, si no, lo pedido en el formulario. Las alertas del tablero agrupan los días con ocupación ≥ 80 % (advertencia) o ≥ 100 % (crítica).

**Roles.** Administrador: todo. Ventas: tablero, calendario, CRM y presupuestos. Logística: tablero, calendario, inventario (edición) y expedientes. `src/proxy.ts` hace la verificación inicial de sesión y cada página y acción del servidor vuelve a validar el permiso.

**Zona horaria.** Toda la lógica opera en hora de Ecuador continental (UTC−5), independientemente del servidor o navegador.

## Producción

1. En `prisma/schema.prisma` cambie `provider = "postgresql"` y apunte `DATABASE_URL` a la base.
2. `npx prisma db push` (o migraciones) y opcionalmente `npm run db:seed`.
3. `npm run build && npm start` (Node 20+). Configure `AUTH_SECRET`, `ANTHROPIC_API_KEY` y las variables de WhatsApp.
4. Suba el video reel (p. ej. `public/media/reel.mp4`) y configure su URL en la Vista 10.
