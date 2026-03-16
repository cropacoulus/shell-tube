import type { CreatorPayoutLedgerRecord } from "@/lib/contracts/revenue";
import type { RevenueRepository } from "@/lib/repositories/revenue-repository";
import { getMySqlPool } from "@/lib/repositories/mysql/mysql-connection";
import { toMysqlDateTime } from "@/lib/repositories/mysql/mysql-datetime";

type CreatorPayoutLedgerRow = {
  id: string;
  creator_profile_id: string | null;
  course_id: string | null;
  course_title: string | null;
  period_key: string;
  amount_usd: string | number;
  currency: "USD";
  source_type: "course_revenue" | "subscription_revenue_share";
  status: "projected" | "settled";
  formula_snapshot: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapLedgerRow(row: CreatorPayoutLedgerRow): CreatorPayoutLedgerRecord {
  return {
    id: row.id,
    creatorProfileId: row.creator_profile_id ?? undefined,
    courseId: row.course_id ?? undefined,
    courseTitle: row.course_title ?? undefined,
    periodKey: row.period_key,
    amountUsd: Number(row.amount_usd),
    currency: row.currency,
    sourceType: row.source_type,
    status: row.status,
    formulaSnapshot: row.formula_snapshot,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function getExistingRecord(input: {
  creatorProfileId?: string;
  courseId?: string;
  periodKey: string;
  sourceType: "course_revenue" | "subscription_revenue_share";
  status: "projected" | "settled";
}) {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    `SELECT id, creator_profile_id, course_id, course_title, period_key, amount_usd, currency, source_type, status, formula_snapshot, created_at, updated_at
     FROM creator_payout_ledger
     WHERE creator_profile_id <=> ? AND course_id <=> ? AND period_key = ? AND source_type = ? AND status = ?
     LIMIT 1`,
    [input.creatorProfileId ?? null, input.courseId ?? null, input.periodKey, input.sourceType, input.status],
  );
  const row = (rows as CreatorPayoutLedgerRow[])[0];
  return row ? mapLedgerRow(row) : null;
}

export const mysqlRevenueRepository: RevenueRepository = {
  async listCreatorPayoutLedger() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      `SELECT id, creator_profile_id, course_id, course_title, period_key, amount_usd, currency, source_type, status, formula_snapshot, created_at, updated_at
       FROM creator_payout_ledger
       ORDER BY updated_at DESC, created_at DESC`,
    );
    return (rows as CreatorPayoutLedgerRow[]).map(mapLedgerRow);
  },
  async upsertCreatorPayoutLedgerRecord(input) {
    const pool = await getMySqlPool();
    const now = toMysqlDateTime(new Date());
    const existing = await getExistingRecord({
      creatorProfileId: input.creatorProfileId,
      courseId: input.courseId,
      periodKey: input.periodKey,
      sourceType: input.sourceType,
      status: input.status,
    });
    if (existing) {
      await pool.execute(
        `UPDATE creator_payout_ledger
         SET course_title = ?, amount_usd = ?, currency = ?, formula_snapshot = ?, updated_at = ?
         WHERE id = ?`,
        [input.courseTitle ?? null, input.amountUsd, input.currency, input.formulaSnapshot, now, existing.id],
      );
      const updated = await getExistingRecord({
        creatorProfileId: input.creatorProfileId,
        courseId: input.courseId,
        periodKey: input.periodKey,
        sourceType: input.sourceType,
        status: input.status,
      });
      if (!updated) throw new Error("Unable to load updated payout ledger record.");
      return updated;
    }

    const id = input.id ?? `ledger_${crypto.randomUUID().slice(0, 8)}`;
    const createdAt = toMysqlDateTime(input.createdAt);
    await pool.execute(
      `INSERT INTO creator_payout_ledger
       (id, creator_profile_id, course_id, course_title, period_key, amount_usd, currency, source_type, status, formula_snapshot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.creatorProfileId ?? null,
        input.courseId ?? null,
        input.courseTitle ?? null,
        input.periodKey,
        input.amountUsd,
        input.currency,
        input.sourceType,
        input.status,
        input.formulaSnapshot,
        createdAt,
        now,
      ],
    );
    const created = await getExistingRecord({
      creatorProfileId: input.creatorProfileId,
      courseId: input.courseId,
      periodKey: input.periodKey,
      sourceType: input.sourceType,
      status: input.status,
    });
    if (!created) throw new Error("Unable to load created payout ledger record.");
    return created;
  },
  async updateCreatorPayoutLedgerStatus(id, status) {
    const pool = await getMySqlPool();
    const now = toMysqlDateTime(new Date());
    await pool.execute(
      `UPDATE creator_payout_ledger
       SET status = ?, updated_at = ?
       WHERE id = ?`,
      [status, now, id],
    );
    const [rows] = await pool.execute(
      `SELECT id, creator_profile_id, course_id, course_title, period_key, amount_usd, currency, source_type, status, formula_snapshot, created_at, updated_at
       FROM creator_payout_ledger
       WHERE id = ?
       LIMIT 1`,
      [id],
    );
    const row = (rows as CreatorPayoutLedgerRow[])[0];
    return row ? mapLedgerRow(row) : null;
  },
};
