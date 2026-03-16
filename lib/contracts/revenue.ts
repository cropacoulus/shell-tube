export type RevenueSourceType = "course_revenue" | "subscription_revenue_share";

export type CreatorPayoutLedgerRecord = {
  id: string;
  creatorProfileId?: string;
  courseId?: string;
  courseTitle?: string;
  periodKey: string;
  amountUsd: number;
  currency: "USD";
  sourceType: RevenueSourceType;
  status: "projected" | "settled";
  formulaSnapshot: string;
  createdAt: string;
  updatedAt: string;
};
