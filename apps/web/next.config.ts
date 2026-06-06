import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

// Permissive enough not to break Next/RSC, strict enough to add real defense.
// img-src allows https: so externally-hosted impact evidence images render.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // allow the Sentry browser SDK to send events/traces to its ingest endpoint
  "connect-src 'self' https://*.ingest.us.sentry.io https://*.ingest.sentry.io",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
  // wagmi/walletconnect connectors reference optional React-Native / pretty-logging deps we don't use
  // in the browser — externalize them so the build doesn't warn about unresolved optional modules.
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), "pino-pretty", "lokijs", "encoding"];
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

// Sentry wrap. Runtime capture is gated on the DSN env vars (no-op if unset); no auth token needed to build.
export default withSentryConfig(nextConfig, {
  org: "vitacrypt",
  project: "regenbazaar",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
