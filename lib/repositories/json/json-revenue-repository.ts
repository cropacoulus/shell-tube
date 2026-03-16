import type { RevenueRepository } from "@/lib/repositories/revenue-repository";
import {
  listCreatorPayoutLedger,
  updateCreatorPayoutLedgerStatus,
  upsertCreatorPayoutLedgerRecord,
} from "@/lib/server/data-store";

export const jsonRevenueRepository: RevenueRepository = {
  listCreatorPayoutLedger,
  upsertCreatorPayoutLedgerRecord,
  updateCreatorPayoutLedgerStatus,
};
