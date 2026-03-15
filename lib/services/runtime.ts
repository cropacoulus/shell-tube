export type RuntimeMode = "development" | "staging" | "production";

export function getRuntimeMode(): RuntimeMode {
  const fromAppEnv = (process.env.APP_ENV ?? "").toLowerCase();
  if (fromAppEnv === "staging" || fromAppEnv === "production" || fromAppEnv === "development") {
    return fromAppEnv;
  }
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export function isStrictServiceMode(): boolean {
  const fromEnv = process.env.SERVICE_STRICT_MODE;
  if (fromEnv === "true") return true;
  if (fromEnv === "false") return false;

  const mode = getRuntimeMode();
  return mode === "staging" || mode === "production";
}

export function allowMockFallback(): boolean {
  if (process.env.ALLOW_MOCK_FALLBACK === "true") return true;
  if (process.env.ALLOW_MOCK_FALLBACK === "false") return false;
  return !isStrictServiceMode();
}
