import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages are shipped as TypeScript source; let Next compile them.
  transpilePackages: ["@rb/db", "@rb/impact-engine", "@rb/pipeline"],
  // Native/WASM DB drivers load at runtime (Node), not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // ESLint not configured for the new app yet; lint is run separately.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
