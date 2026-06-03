import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (apps/web/.next/standalone/…/server.js).
  output: "standalone",
  // Monorepo root, so file tracing pulls in the workspace packages' files for the standalone output.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  // Workspace packages are shipped as TypeScript source; let Next compile them.
  transpilePackages: ["@rb/db", "@rb/impact-engine", "@rb/pipeline"],
  // Native/WASM DB drivers load at runtime (Node), not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // ESLint not configured for the new app yet; lint is run separately.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
