import type { NextConfig } from "next";

// Baseline security headers (Art. 46), applied to every route. The CSP is
// conservative-but-compatible: it allows the inline styles Next/Tailwind emit and
// images from https (Azure Blob $web), while forbidding framing and locking down
// base-uri/form-action. Tighten script-src with nonces in a later pass.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https:",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  experimental: {
    // Listing photos travel through server actions (publishAnuncio / saveVehicle)
    // as data URLs — the default 1MB cap is too small.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
