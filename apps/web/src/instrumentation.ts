import * as Sentry from "@sentry/nextjs";

// Server + edge init. Disabled unless SENTRY_DSN is set, so this is a no-op without the key.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      enabled: !!dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
