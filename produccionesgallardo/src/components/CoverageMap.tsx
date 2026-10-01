// Mapa esquemático de cobertura en El Oro (proyección lineal lat/lng → SVG).
type Point = { canton: string; lat: number; lng: number; extraHours: number };

const BOUNDS = { minLat: -3.86, maxLat: -3.16, minLng: -80.32, maxLng: -79.5 };
const W = 420;
const H = 360;
const project = (lat: number, lng: number) => ({
  x: ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W,
  y: ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H,
});

export function CoverageMap({ points }: { points: Point[] }) {
  const hq = points.find((p) => p.canton === "Machala");
  const origin = hq ? project(hq.lat, hq.lng) : { x: 0, y: 0 };
  return (
    <svg viewBox={`-20 -20 ${W + 40} ${H + 40}`} className="h-auto w-full" role="img" aria-label="Mapa de cantones atendidos en El Oro">
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="#f5b301" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f5b301" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Contorno aproximado de la provincia */}
      <path
        d="M10 40 L120 10 L260 30 L400 60 L410 170 L380 300 L300 345 L170 340 L90 290 L40 210 L0 120 Z"
        fill="#ffffff08"
        stroke="#ffffff22"
        strokeDasharray="4 6"
      />
      <text x="395" y="335" textAnchor="end" className="fill-white/25 text-[11px] font-semibold tracking-[0.3em]">EL ORO</text>
      <text x="-10" y="20" className="fill-sky-300/40 text-[10px] italic">Océano Pacífico</text>
      {points.map((p) => {
        const { x, y } = project(p.lat, p.lng);
        return p.canton === "Machala" ? null : (
          <line key={`l-${p.canton}`} x1={origin.x} y1={origin.y} x2={x} y2={y} stroke="#f5b301" strokeOpacity="0.25" strokeDasharray="3 4" />
        );
      })}
      {points.map((p) => {
        const { x, y } = project(p.lat, p.lng);
        const isHq = p.canton === "Machala";
        return (
          <g key={p.canton} className="group cursor-default">
            <title>{`${p.canton}: ${isHq ? "base de operaciones" : `+${p.extraHours} h de traslado`}`}</title>
            {isHq && <circle cx={x} cy={y} r="34" fill="url(#glow)" className="animate-pulse" />}
            <circle cx={x} cy={y} r={isHq ? 8 : 5} fill={isHq ? "#f5b301" : "#ffd76a"} stroke="#07070a" strokeWidth="2" />
            <text x={x + 9} y={y + 4} className={`${isHq ? "fill-white text-[13px] font-bold" : "fill-white/70 text-[11px]"} transition group-hover:fill-gold-300`}>
              {p.canton}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
