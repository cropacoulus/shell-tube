import type { CreatorPayoutLedgerRecord } from "@/lib/contracts/revenue";

export type RevenueRepository = {
  listCreatorPayoutLedger(): Promise<CreatorPayoutLedgerRecord[]>;
  upsertCreatorPayoutLedgerRecord(
    input: Omit<CreatorPayoutLedgerRecord, "id" | "updatedAt"> & { id?: string },
  ): Promise<CreatorPayoutLedgerRecord>;
  updateCreatorPayoutLedgerStatus(
    id: string,
    status: "projected" | "settled",
  ): Promise<CreatorPayoutLedgerRecord | null>;
};
