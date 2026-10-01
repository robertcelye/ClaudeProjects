import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Producciones Gallardo · Audio, Pantallas LED, Tarimas y Banda en Vivo", template: "%s · Producciones Gallardo" },
  description:
    "Infraestructura técnica propia para eventos en Machala, El Oro y todo el Ecuador: audio line array, pantallas LED, tarimas certificadas y banda en vivo. Cotiza y agenda tu cita.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
