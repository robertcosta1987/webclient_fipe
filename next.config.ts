import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Listing photos travel through server actions (publishAnuncio / saveVehicle)
    // as data URLs — the default 1MB cap is too small.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
