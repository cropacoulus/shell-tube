import type { CreatorRevenueSnapshot } from "@/lib/server/creator-revenue-flow";
import { createDefaultProjectionStore } from "@/lib/projection-store";

type PayoutProjectionRecord = {
  ledgerEntryId: string;
  creatorProfileId?: string;
  courseId?: string;
  courseTitle?: string;
  periodKey: string;
  amountUsd: number;
  currency: "USD";
  sourceType: "course_revenue" | "subscription_revenue_share";
  status: "projected" | "settled";
  formulaSnapshot: string;
  createdAt: string;
  updatedAt: string;
};

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getCreatorRevenueSnapshotFromProjection(input?: {
  role?: "student" | "creator" | "admin";
  profileId?: string;
}): Promise<CreatorRevenueSnapshot> {
  const projectionStore = createDefaultProjectionStore();
  const payoutMap =
    (await projectionStore.getJson<Record<string, PayoutProjectionRecord>>("stream:projection:payout:all")) ?? {};

  const payoutLedger = Object.values(payoutMap)
    .filter((entry) => {
      if (input?.role === "creator") return entry.creatorProfileId === input.profileId;
      return true;
    })
    .map((entry) => ({
      id: entry.ledgerEntryId,
      creatorProfileId: entry.creatorProfileId,
      courseId: entry.courseId,
      courseTitle: entry.courseTitle,
      periodKey: entry.periodKey,
      amountUsd: entry.amountUsd,
      currency: entry.currency,
      sourceType: entry.sourceType,
      status: entry.status,
      formulaSnapshot: entry.formulaSnapshot,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }))
    .sort((left, right) => right.amountUsd - left.amountUsd || left.sourceType.localeCompare(right.sourceType));

  const projectedSubscriptionShareUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "subscription_revenue_share" && entry.status === "projected")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const projectedCourseRevenueUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "course_revenue" && entry.status === "projected")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const settledSubscriptionShareUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "subscription_revenue_share" && entry.status === "settled")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );
  const settledCourseRevenueUsd = roundUsd(
    payoutLedger
      .filter((entry) => entry.sourceType === "course_revenue" && entry.status === "settled")
      .reduce((sum, entry) => sum + entry.amountUsd, 0),
  );

  return {
    projectedSubscriptionShareUsd,
    projectedCourseRevenueUsd,
    totalProjectedRevenueUsd: roundUsd(projectedSubscriptionShareUsd + projectedCourseRevenueUsd),
    settledSubscriptionShareUsd,
    settledCourseRevenueUsd,
    totalSettledRevenueUsd: roundUsd(settledSubscriptionShareUsd + settledCourseRevenueUsd),
    payoutLedger,
  };
}

export async function getPayoutLedgerEntryFromProjection(id: string) {
  const projectionStore = createDefaultProjectionStore();
  const payoutMap =
    (await projectionStore.getJson<Record<string, PayoutProjectionRecord>>("stream:projection:payout:all")) ?? {};

  const entry = Object.values(payoutMap).find((item) => item.ledgerEntryId === id);
  if (!entry) return null;

  return {
    id: entry.ledgerEntryId,
    creatorProfileId: entry.creatorProfileId,
    courseId: entry.courseId,
    courseTitle: entry.courseTitle,
    periodKey: entry.periodKey,
    amountUsd: entry.amountUsd,
    currency: entry.currency,
    sourceType: entry.sourceType,
    status: entry.status,
    formulaSnapshot: entry.formulaSnapshot,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
