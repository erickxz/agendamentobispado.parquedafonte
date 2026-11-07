import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Só vale para o `next dev`: libera abrir o servidor de desenvolvimento pelo IP da rede local
  // (ex.: testar no celular em http://192.168.100.103:3000). Não tem efeito em produção.
  allowedDevOrigins: ["192.168.*.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "id.churchofjesuschrist.org",
        pathname: "/images/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
