import * as Sentry from "@sentry/nextjs";

// Browser init. Disabled unless NEXT_PUBLIC_SENTRY_DSN is set (no-op without it).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
