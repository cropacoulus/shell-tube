import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { jsonError, jsonOk } from "@/lib/server/http";

function isAuthorized(req: Request) {
  const config = createOptionBConfig();
  if (!config.cronSecret) return false;

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  return authorization.slice("Bearer ".length) === config.cronSecret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return jsonError("FORBIDDEN", "Cron secret is required", 403);
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 200;

  if (!Number.isFinite(limit) || limit <= 0) {
    return jsonError("INVALID_REQUEST", "limit must be a positive number", 422);
  }

  const result = await runProjectionBatch(Math.min(500, Math.floor(limit)));
  return jsonOk(result);
}
