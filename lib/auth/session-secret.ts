const FALLBACK_SESSION_SECRET = "verra-wallet-auth-fallback-secret";

export function getSessionAuthSecret() {
  return process.env.AUTH_JWT_SECRET || process.env.CRON_SECRET || FALLBACK_SESSION_SECRET;
}
