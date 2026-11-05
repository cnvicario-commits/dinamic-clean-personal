import type { NextConfig } from "next";
import { cristianFrontendUsesStandalone } from "./scripts/assert-cristian-frontend-env.mjs";

const nextConfig: NextConfig = {
  // The Vercel production build does not set this variable and keeps the default output.
  ...(cristianFrontendUsesStandalone(process.env) ? { output: "standalone" as const } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // CSP_FRONTEND_NOT_ENFORCED — inventory deferred; do not add aggressive CSP here.
        ],
      },
    ];
  },
};

export default nextConfig;
