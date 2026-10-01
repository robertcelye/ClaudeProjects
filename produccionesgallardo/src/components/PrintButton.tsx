"use client";

export function PrintButton({ label = "Descargar PDF", className = "btn-gold" }: { label?: string; className?: string }) {
  return (
    <button onClick={() => window.print()} className={`no-print ${className}`}>
      {label}
    </button>
  );
}
