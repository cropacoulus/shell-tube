import type { CreatorApplicationRecord, CreatorApplicationStatus } from "@/lib/contracts/creator-application";
import type { CreatorApplicationRepository } from "@/lib/repositories/creator-application-repository";
import { getMySqlPool } from "@/lib/repositories/mysql/mysql-connection";
import { toMysqlDateTime } from "@/lib/repositories/mysql/mysql-datetime";

type CreatorApplicationRow = {
  id: string;
  user_id: string;
  display_name: string;
  pitch: string;
  status: CreatorApplicationStatus;
  created_at: string | Date;
  updated_at: string | Date;
  reviewed_by_user_id: string | null;
  reviewed_at: string | Date | null;
};

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: CreatorApplicationRow): CreatorApplicationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    pitch: row.pitch,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    reviewedByUserId: row.reviewed_by_user_id ?? undefined,
    reviewedAt: row.reviewed_at ? toIsoString(row.reviewed_at) : undefined,
  };
}

async function getById(id: string) {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    `SELECT id, user_id, display_name, pitch, status, created_at, updated_at, reviewed_by_user_id, reviewed_at
     FROM creator_applications WHERE id = ? LIMIT 1`,
    [id],
  );
  const row = (rows as CreatorApplicationRow[])[0];
  return row ? mapRow(row) : null;
}

export const mysqlCreatorApplicationRepository: CreatorApplicationRepository = {
  async listCreatorApplications() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      `SELECT id, user_id, display_name, pitch, status, created_at, updated_at, reviewed_by_user_id, reviewed_at
       FROM creator_applications ORDER BY updated_at DESC, created_at DESC`,
    );
    return (rows as CreatorApplicationRow[]).map(mapRow);
  },
  async listCreatorApplicationsByUser(userId) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      `SELECT id, user_id, display_name, pitch, status, created_at, updated_at, reviewed_by_user_id, reviewed_at
       FROM creator_applications WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC`,
      [userId],
    );
    return (rows as CreatorApplicationRow[]).map(mapRow);
  },
  async createCreatorApplication(input) {
    const pool = await getMySqlPool();
    const now = toMysqlDateTime(new Date());
    const id = `creator_app_${crypto.randomUUID().slice(0, 8)}`;
    await pool.execute(
      `INSERT INTO creator_applications
       (id, user_id, display_name, pitch, status, created_at, updated_at, reviewed_by_user_id, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.userId, input.displayName, input.pitch, "pending", now, now, null, null],
    );
    const created = await getById(id);
    if (!created) throw new Error("Unable to load created creator application.");
    return created;
  },
  async updateCreatorApplicationStatus(id, input) {
    const pool = await getMySqlPool();
    const now = toMysqlDateTime(new Date());
    await pool.execute(
      `UPDATE creator_applications
       SET status = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ?`,
      [input.status, input.reviewedByUserId, now, now, id],
    );
    return getById(id);
  },
};
