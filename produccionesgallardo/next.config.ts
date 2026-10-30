import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Servidor autónomo mínimo para la imagen Docker (.next/standalone)
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
