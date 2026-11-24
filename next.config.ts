import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Fotos: el navegador las reduce antes de subir; el servidor acepta hasta 4 MB.
    // Vercel corta las peticiones arriba de ~4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  images: {
    remotePatterns: process.env.SUPABASE_URL ? [new URL(`${process.env.SUPABASE_URL}/storage/v1/object/public/**`)] : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
