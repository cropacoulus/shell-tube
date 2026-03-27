import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { canModeratePlatform, canViewCreatorAnalytics } from "@/lib/auth/capabilities";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import {
  getCreatorRevenueSnapshotFromProjection,
  getPayoutLedgerEntryFromProjection,
} from "@/lib/projections/payout-read-model";
import { getEventStore, getRevenueRepository } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { syncCreatorRevenueLedger } from "@/lib/server/creator-revenue-flow";

export async function GET(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canViewCreatorAnalytics(effectiveRole)) {
    return jsonError("FORBIDDEN", "Creator or admin access required", 403);
  }

  const optionB = createOptionBConfig();
  if (optionB.projectionStoreBackend === "upstash") {
    const snapshot = await getCreatorRevenueSnapshotFromProjection({
      role: effectiveRole,
      profileId: auth.profileId,
    });
    return jsonOk(snapshot);
  }

  const snapshot = await syncCreatorRevenueLedger({
    role: effectiveRole,
    profileId: auth.profileId,
  });

  return jsonOk(snapshot);
}

type PayoutStatusPatchRequest = {
  id: string;
  status: "projected" | "settled";
};

function isValidPatch(body: unknown): body is PayoutStatusPatchRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate.id === "string" && (candidate.status === "projected" || candidate.status === "settled");
}

export async function PATCH(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) return jsonError("UNAUTHORIZED", "Session is required", 401);
  if (!canModeratePlatform(auth.role)) {
    return jsonError("FORBIDDEN", "Admin access required", 403);
  }

  const body = (await req.json().catch(() => null)) as unknown;
  if (!isValidPatch(body)) {
    return jsonError("INVALID_REQUEST", "id and status are required", 422);
  }

  const optionB = createOptionBConfig();
  const updated = optionB.projectionStoreBackend === "upstash"
    ? await (async () => {
        const existing = await getPayoutLedgerEntryFromProjection(body.id);
        if (!existing) return null;
        return {
          ...existing,
          status: body.status,
          updatedAt: new Date().toISOString(),
        };
      })()
    : await getRevenueRepository().updateCreatorPayoutLedgerStatus(body.id, body.status);
  if (!updated) {
    return jsonError("NOT_FOUND", "Payout ledger record not found", 404);
  }

  await getEventStore().appendEvent(
    createDomainEvent({
      type: body.status === "settled" ? "payout_settled" : "payout_projected",
      aggregateType: "payout_ledger",
      aggregateId: updated.id,
      actor: {
        userId: auth.userId,
        role: auth.role,
      },
      idempotencyKey: buildEventIdempotencyKey("payout-status-update", updated.id, body.status),
      payload: {
        ledgerEntryId: updated.id,
        creatorProfileId: updated.creatorProfileId,
        courseId: updated.courseId,
        courseTitle: updated.courseTitle,
        periodKey: updated.periodKey,
        amountUsd: updated.amountUsd,
        currency: updated.currency,
        sourceType: updated.sourceType,
        status: updated.status,
        formulaSnapshot: updated.formulaSnapshot,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    }),
  );

  await runProjectionBatch(200);

  return jsonOk(updated);
}
