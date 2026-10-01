export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-black tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#f5b301" />
        <path d="M8 21V11h3v10H8Zm6.5 3V8h3v16h-3ZM21 19v-6h3v6h-3Z" fill="#07070a" />
      </svg>
      <span>
        PRODUCCIONES <span className="text-gold-500">GALLARDO</span>
      </span>
    </span>
  );
}
