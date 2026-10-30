// Datos iniciales: usuarios, inventario propio, reglas de traslado, marcas y solicitudes de ejemplo.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeBlock } from "../src/lib/availability";
import { addDays, addHours, dayKey, parseLocal } from "../src/lib/dates";
import { SETTING_DEFAULTS } from "../src/lib/settings";

const prisma = new PrismaClient();

const ASSETS = [
  // Audio
  { key: "la", name: "Line Array (caja)", category: "AUDIO", unit: "caja", totalStock: 24, maintenanceUnits: 2, dailyRate: 45, recommendedCapacity: "8 cajas: hasta 1.500 personas · 16 cajas: hasta 5.000 · 24 cajas: festivales", description: "Sistema line array de 3 vías para conciertos y festivales.", specs: "Respuesta 55 Hz–19 kHz · SPL máx. 139 dB · Dispersión 100°×10° · Montaje volado o ground-stack" },
  { key: "sub", name: "Subwoofer doble 18\"", category: "AUDIO", unit: "unidad", totalStock: 16, maintenanceUnits: 1, dailyRate: 40, recommendedCapacity: "1 sub por cada 2 cajas line array", description: "Refuerzo de bajas frecuencias para eventos masivos.", specs: "2×18\" · 35 Hz–150 Hz · SPL máx. 140 dB · Amplificación integrada" },
  { key: "mic", name: "Microfonía inalámbrica", category: "AUDIO", unit: "canal", totalStock: 16, maintenanceUnits: 0, dailyRate: 15, recommendedCapacity: "Bodas: 2–4 canales · Corporativo: 4–8 canales", description: "Micrófonos de mano y diadema UHF digitales.", specs: "UHF digital · Alcance 100 m · Cápsulas cardioides · Baterías recargables" },
  { key: "console", name: "Consola digital 48 canales", category: "AUDIO", unit: "unidad", totalStock: 3, maintenanceUnits: 0, dailyRate: 120, recommendedCapacity: "Una por escenario; monitoreo independiente desde 2 consolas", description: "Consola digital con stage box y grabación multitrack.", specs: "48 entradas · 24 buses · Stage box Dante · Grabación multitrack USB" },
  { key: "monitor", name: "Monitor de piso 12\"", category: "AUDIO", unit: "unidad", totalStock: 12, maintenanceUnits: 1, dailyRate: 15, recommendedCapacity: "1 por músico en tarima", description: "Monitores de escenario activos.", specs: "12\" + driver 1.4\" · 1.000 W · Ángulo 40°/60°" },
  { key: "sound-basic", name: "Sistema de sonido para eventos sociales", category: "AUDIO", unit: "set", totalStock: 4, maintenanceUnits: 0, dailyRate: 250, recommendedCapacity: "Hasta 300 personas", description: "Set compacto: 4 tops, 2 subs, mezclador y 2 micrófonos.", specs: "4 tops 12\" · 2 subs 18\" · Mezcladora 16 canales · 2 mic inalámbricos" },
  // Video / LED
  { key: "led-out", name: "Pantalla LED P3.9 exterior", category: "VIDEO_LED", unit: "m²", totalStock: 40, maintenanceUnits: 2, dailyRate: 35, recommendedCapacity: "12 m²: hasta 1.000 personas · 24 m²: hasta 5.000 · 36 m²+: festivales", description: "Módulos LED de alto brillo para exterior.", specs: "Pitch 3.9 mm · 5.000 nits · IP65 · Gabinetes 500×1000 mm · Refresco 3.840 Hz" },
  { key: "led-in", name: "Pantalla LED P2.6 interior", category: "VIDEO_LED", unit: "m²", totalStock: 24, maintenanceUnits: 0, dailyRate: 40, recommendedCapacity: "8–12 m² para salones y eventos corporativos", description: "Módulos de alta resolución para interiores.", specs: "Pitch 2.6 mm · 1.000 nits · Gabinetes 500×500 mm · Refresco 3.840 Hz" },
  { key: "proc", name: "Procesador de video 4K", category: "VIDEO_LED", unit: "unidad", totalStock: 4, maintenanceUnits: 0, dailyRate: 60, recommendedCapacity: "Uno por pantalla", description: "Procesador y switcher para alimentar las pantallas LED.", specs: "Entradas HDMI 2.0/SDI · Escalado 4K · Conmutación sin cortes" },
  // Estructuras
  { key: "stage", name: "Tarima modular certificada", category: "ESTRUCTURAS", unit: "m²", totalStock: 160, maintenanceUnits: 8, dailyRate: 6, recommendedCapacity: "Bodas: 24–36 m² · Conciertos: 60–120 m²", description: "Plataformas modulares de aluminio con altura regulable.", specs: "Módulos 2×1 m · Carga 750 kg/m² · Altura 0,4–1,8 m · Escaleras y barandas" },
  { key: "truss", name: "Techado truss", category: "ESTRUCTURAS", unit: "set", totalStock: 3, maintenanceUnits: 0, dailyRate: 450, recommendedCapacity: "Cubre tarimas de hasta 12×8 m", description: "Estructura de techo truss con lona impermeable.", specs: "Truss 40×40 cm · Luz 12 m · Altura 9 m · Lona PVC impermeable" },
  { key: "runway", name: "Pasarela", category: "ESTRUCTURAS", unit: "m", totalStock: 30, maintenanceUnits: 0, dailyRate: 8, recommendedCapacity: "Desfiles y shows: 10–20 m", description: "Pasarela modular con alfombra.", specs: "Ancho 1,2 m · Altura 0,6 m · Alfombra incluida" },
  // Banda
  { key: "band-ac", name: "Banda — Formato Acústico", category: "BANDA", unit: "show", totalStock: 1, maintenanceUnits: 0, dailyRate: 600, recommendedCapacity: "Ceremonias y cócteles hasta 200 personas", description: "Voz, guitarra y percusión.", specs: "3 músicos · 2 sets de 45 min · Repertorio romántico, pop y baladas" },
  { key: "band-full", name: "Banda — Banda Completa", category: "BANDA", unit: "show", totalStock: 1, maintenanceUnits: 0, dailyRate: 1500, recommendedCapacity: "Fiestas y eventos corporativos hasta 1.000 personas", description: "7 músicos con repertorio bailable.", specs: "7 músicos · 3 sets de 45 min · Salsa, merengue, cumbia, pop y rock" },
  { key: "band-show", name: "Banda — Orquesta Show", category: "BANDA", unit: "show", totalStock: 1, maintenanceUnits: 0, dailyRate: 3500, recommendedCapacity: "Festivales y eventos masivos", description: "12 músicos + bailarinas, show de alto impacto.", specs: "12 músicos + 4 bailarinas · 2 sets de 60 min · Vestuario y coreografías" },
] as const;

const CANTONS = [
  { canton: "Machala", extraHours: 0, lat: -3.2581, lng: -79.9553 },
  { canton: "El Guabo", extraHours: 2, lat: -3.2393, lng: -79.8287 },
  { canton: "Pasaje", extraHours: 2, lat: -3.3269, lng: -79.8064 },
  { canton: "Santa Rosa", extraHours: 2, lat: -3.4489, lng: -79.9597 },
  { canton: "Arenillas", extraHours: 4, lat: -3.5516, lng: -80.0636 },
  { canton: "Huaquillas", extraHours: 6, lat: -3.4757, lng: -80.2306 },
  { canton: "Las Lajas", extraHours: 8, lat: -3.7833, lng: -80.0667 },
  { canton: "Chilla", extraHours: 12, lat: -3.4500, lng: -79.5833 },
  { canton: "Atahualpa", extraHours: 12, lat: -3.5667, lng: -79.6500 },
  { canton: "Balsas", extraHours: 10, lat: -3.7667, lng: -79.8167 },
  { canton: "Marcabelí", extraHours: 10, lat: -3.7833, lng: -79.9000 },
  { canton: "Piñas", extraHours: 12, lat: -3.6806, lng: -79.6806, note: "Cantón alto: flete y desmontaje en vía de montaña" },
  { canton: "Portovelo", extraHours: 12, lat: -3.7167, lng: -79.6167, note: "Cantón alto" },
  { canton: "Zaruma", extraHours: 12, lat: -3.6911, lng: -79.6114, note: "Cantón alto: flete y desmontaje en vía de montaña" },
  { canton: "Otra provincia", extraHours: 24, lat: null, lng: null, province: "Nacional", covered: false, note: "Valor por defecto para eventos fuera de El Oro" },
];

// SEED_MODE=demo (por defecto): usuarios de prueba + solicitudes de ejemplo.
// SEED_MODE=base: solo el administrador (ADMIN_EMAIL / ADMIN_PASSWORD), configuración,
//   inventario, cantones y marcas. Pensado para el primer arranque en producción.
// La semilla borra los datos existentes: si ya hay solicitudes se detiene salvo SEED_FORCE=1.
const MODE = process.env.SEED_MODE === "base" ? "base" : "demo";

async function main() {
  const existing = await prisma.request.count();
  if (existing > 0 && process.env.SEED_FORCE !== "1") {
    console.error(`La base ya tiene ${existing} solicitudes. La semilla las borraría; use SEED_FORCE=1 si de verdad quiere reiniciarla.`);
    process.exit(1);
  }
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@produccionesgallardo.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? (MODE === "demo" ? "Admin123!" : "");
  if (adminPassword.length < 8) {
    console.error("Defina ADMIN_PASSWORD (mínimo 8 caracteres) para crear el administrador.");
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.activity.deleteMany(),
    prisma.aiMessage.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.quoteItem.deleteMany(),
    prisma.requestItem.deleteMany(),
    prisma.request.deleteMany(),
    prisma.client.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.transferRule.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const pass = (p: string) => bcrypt.hashSync(p, 10);
  await prisma.user.create({ data: { name: "Administrador", email: adminEmail, passwordHash: pass(adminPassword), role: "ADMIN" } });
  if (MODE === "demo") {
    await prisma.user.createMany({
      data: [
        { name: "María Ventas", email: "ventas@produccionesgallardo.com", passwordHash: pass("Ventas123!"), role: "VENTAS" },
        { name: "Luis Logística", email: "logistica@produccionesgallardo.com", passwordHash: pass("Logistica123!"), role: "LOGISTICA" },
      ],
    });
  }

  await prisma.setting.createMany({ data: Object.entries(SETTING_DEFAULTS).map(([key, value]) => ({ key, value })) });

  const asset: Record<string, string> = {};
  for (const { key, ...a } of ASSETS) asset[key] = (await prisma.asset.create({ data: a })).id;

  await prisma.transferRule.createMany({
    data: CANTONS.map((c) => ({ canton: c.canton, extraHours: c.extraHours, lat: c.lat, lng: c.lng, note: c.note ?? "", province: c.province ?? "El Oro", covered: c.covered ?? true })),
  });

  await prisma.brand.createMany({
    data: ["GAD Municipal de Machala", "Feria Mundial del Banano", "Banco del Pacífico", "Universidad Técnica de Machala", "Cervecería Nacional", "Prefectura de El Oro"].map((name, order) => ({ name, order })),
  });

  if (MODE === "base") {
    console.log(`Semilla base cargada ✔  Administrador: ${adminEmail}`);
    return;
  }

  // Solicitudes de ejemplo (fechas relativas a hoy)
  const today = parseLocal(dayKey(new Date()));
  const at = (days: number, hour: number) => addHours(addDays(today, days), hour);
  const nextSat = (() => {
    let d = 1;
    while (new Date(at(d, 12).getTime() - 5 * 3600_000).getUTCDay() !== 6) d++;
    return d;
  })();

  type Sample = {
    name: string; email: string; whatsapp: string; eventType: string; status: string;
    setupDay: number; setupHour: number; eventHour: number; eventDay?: number; endHours?: number;
    locationType: string; canton: string; audience: number; description: string;
    items: [string, number][]; quote?: boolean; messages?: [string, string][]; appointment?: [number, number, string];
  };
  const samples: Sample[] = [
    { name: "Andrea Romero", email: "andrea.romero@gmail.com", whatsapp: "+593987654321", eventType: "BODA", status: "NUEVO", setupDay: 40, setupHour: 8, eventHour: 18, locationType: "MACHALA", canton: "Machala", audience: 250, description: "Boda en jardín, necesitamos ceremonia acústica y fiesta con banda.", items: [["sound-basic", 1], ["band-ac", 1], ["band-full", 1], ["stage", 24]] },
    { name: "Carlos Jaramillo", email: "cjaramillo@empresa.ec", whatsapp: "+593991112233", eventType: "CORPORATIVO", status: "IA_RESPONDIDO", setupDay: 12, setupHour: 7, eventHour: 15, locationType: "CANTON_EL_ORO", canton: "Pasaje", audience: 400, description: "Lanzamiento de producto, pantalla de fondo y micrófonos para panel.", items: [["led-in", 12], ["proc", 1], ["mic", 6], ["sound-basic", 1]], messages: [["AGENT", "¡Hola Carlos! 👋 Recibimos tu solicitud en Producciones Gallardo para el lanzamiento en Pasaje. ¿El evento será bajo techo o al aire libre?"], ["CLIENT", "Bajo techo, en el salón del hotel."], ["AGENT", "Perfecto. ¿Tienen un horario límite para el montaje en el salón? Así coordinamos la reunión técnica."]] },
    { name: "Fundación Cultural Orense", email: "eventos@fco.org.ec", whatsapp: "+593992223344", eventType: "FESTIVAL", status: "CITA_AGENDADA", setupDay: 25, setupHour: 6, eventHour: 16, endHours: 8, locationType: "CANTON_EL_ORO", canton: "Zaruma", audience: 3000, description: "Festival del café en la plaza central. Artistas invitados con rider propio.", items: [["la", 16], ["sub", 8], ["console", 2], ["monitor", 8], ["led-out", 24], ["proc", 1], ["stage", 96], ["truss", 1]], appointment: [2, 10, "VIRTUAL"], messages: [["AGENT", "¡Hola! Recibimos la solicitud PG del Festival del Café en Zaruma. ¿Los artistas invitados tienen rider técnico propio?"], ["CLIENT", "Sí, dos de ellos. Les envío los riders en la reunión."], ["AGENT", "Excelente. Tengo disponible pasado mañana a las 10:00. ¿Virtual o presencial?"], ["CLIENT", "Virtual por favor"], ["AGENT", "Listo, quedó agendada la reunión virtual. Un asesor te enviará el enlace. 🙌"]] },
    { name: "Gabriela Ordóñez", email: "gaby.ordonez@hotmail.com", whatsapp: "+593993334455", eventType: "BODA", status: "COTIZACION_ENVIADA", setupDay: 18, setupHour: 9, eventHour: 17, locationType: "CANTON_EL_ORO", canton: "Santa Rosa", audience: 180, description: "Recepción en hacienda.", items: [["sound-basic", 1], ["band-full", 1], ["stage", 32]], quote: true },
    { name: "GAD Municipal de Machala", email: "cultura@machala.gob.ec", whatsapp: "+593994445566", eventType: "CONCIERTO", status: "CONFIRMADO", setupDay: nextSat - 1, setupHour: 8, eventDay: nextSat, eventHour: 19, endHours: 5, locationType: "MACHALA", canton: "Machala", audience: 6000, description: "Concierto por fiestas de la ciudad en el malecón.", items: [["la", 24], ["sub", 15], ["console", 2], ["monitor", 10], ["led-out", 38], ["proc", 2], ["stage", 120], ["truss", 2]], quote: true },
    { name: "Hotel Oro Verde", email: "eventos@oroverde.ec", whatsapp: "+593995556677", eventType: "CORPORATIVO", status: "CONFIRMADO", setupDay: nextSat, setupHour: 9, eventHour: 19, endHours: 5, locationType: "MACHALA", canton: "Machala", audience: 300, description: "Gala anual de clientes.", items: [["led-in", 12], ["proc", 1], ["mic", 4], ["sound-basic", 1], ["band-show", 1]], quote: true },
    { name: "Comité Feria de Piñas", email: "feria.pinas@gmail.com", whatsapp: "+593996667788", eventType: "FESTIVAL", status: "CONFIRMADO", setupDay: 33, setupHour: 6, eventHour: 18, endHours: 6, locationType: "CANTON_EL_ORO", canton: "Piñas", audience: 4000, description: "Feria cantonal, dos escenarios.", items: [["la", 16], ["sub", 8], ["console", 1], ["led-out", 24], ["proc", 1], ["stage", 60]], quote: true },
    { name: "Diego Valarezo", email: "dvalarezo@gmail.com", whatsapp: "+593997778899", eventType: "BODA", status: "FINALIZADO", setupDay: -10, setupHour: 9, eventHour: 18, locationType: "MACHALA", canton: "Machala", audience: 150, description: "Boda civil y fiesta.", items: [["sound-basic", 1], ["band-ac", 1]], quote: true },
    { name: "Colegio Ismael Pérez Pazmiño", email: "rectorado@colegioipp.edu.ec", whatsapp: "+593998889900", eventType: "OTRO", status: "CANCELADO", setupDay: 8, setupHour: 8, eventHour: 10, locationType: "MACHALA", canton: "Machala", audience: 800, description: "Graduación (cancelada por cambio de local).", items: [["sound-basic", 2], ["led-out", 12]] },
  ];

  const teardown = Number(SETTING_DEFAULTS.teardownHours);
  let n = 0;
  for (const s of samples) {
    n++;
    const client = await prisma.client.create({ data: { name: s.name, email: s.email, whatsapp: s.whatsapp } });
    const setupDate = at(s.setupDay, s.setupHour);
    const eventDate = at(s.eventDay ?? s.setupDay, s.eventHour);
    const eventEndDate = addHours(eventDate, s.endHours ?? 6);
    const transferHours = CANTONS.find((c) => c.canton === s.canton)?.extraHours ?? 0;
    const block = computeBlock({ setupDate, eventDate, eventEndDate, transferHours, teardownHours: teardown });
    const confirmed = s.status === "CONFIRMADO" || s.status === "FINALIZADO";
    const quoteItems = s.quote ? s.items.map(([k, q]) => ({ assetId: asset[k], quantity: q, unitPrice: ASSETS.find((a) => a.key === k)!.dailyRate, days: 1 })) : [];
    const quoteTotal = quoteItems.reduce((t, i) => t + i.quantity * i.unitPrice * i.days, 0);
    await prisma.request.create({
      data: {
        ticket: `PG-${dayKey(new Date()).slice(2, 7).replace("-", "")}-DEM${n}`,
        clientId: client.id,
        eventType: s.eventType,
        status: s.status,
        setupDate,
        eventDate,
        eventEndDate,
        locationType: s.locationType,
        canton: s.canton,
        province: "El Oro",
        audience: s.audience,
        description: s.description,
        blockStart: confirmed ? block.start : null,
        blockEnd: confirmed ? block.end : null,
        quoteTotal: s.quote ? quoteTotal : null,
        aiActive: !["CONFIRMADO", "FINALIZADO", "CANCELADO", "COTIZACION_ENVIADA"].includes(s.status),
        createdAt: addDays(new Date(), -Math.min(20, Math.abs(s.setupDay) / 2 + n)),
        items: { create: s.items.map(([k, q]) => ({ assetId: asset[k], quantity: q })) },
        quoteItems: { create: quoteItems },
        messages: { create: (s.messages ?? []).map(([role, content], i) => ({ role, content, delivered: false, createdAt: addHours(new Date(), -48 + i) })) },
        appointments: s.appointment
          ? { create: { start: at(s.appointment[0], s.appointment[1]), end: addHours(at(s.appointment[0], s.appointment[1]), 0.75), mode: s.appointment[2], location: "Videollamada", notes: "Agendada por el asistente IA" } }
          : undefined,
        activities: { create: [{ type: "WEBHOOK", message: "Requerimiento recibido desde la web" }] },
      },
    });
  }

  // Otra cita de negociación para poblar el calendario
  const r = await prisma.request.findFirst({ where: { status: "COTIZACION_ENVIADA" } });
  if (r) await prisma.appointment.create({ data: { requestId: r.id, start: at(1, 16), end: at(1, 16.75), mode: "PRESENCIAL", location: "Oficina Machala", notes: "Revisión de cotización" } });

  console.log(`Semilla de demostración cargada ✔  Usuario: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
