import type { ProfileRepository } from "@/lib/repositories/profile-repository";
import { getMySqlPool } from "@/lib/repositories/mysql/mysql-connection";
import { toMysqlDateTime } from "@/lib/repositories/mysql/mysql-datetime";

type ProfileRow = {
  wallet_address: string;
  display_name: string;
  avatar_url: string | null;
  role: "student" | "creator" | "admin";
  updated_at: string | Date;
};

function mapProfileRow(row: ProfileRow) {
  return {
    userId: row.wallet_address,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || undefined,
    role: row.role,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };
}

export const mysqlProfileRepository: ProfileRepository = {
  async getProfile(userId) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT wallet_address, display_name, avatar_url, role, updated_at FROM profiles WHERE wallet_address = ? LIMIT 1",
      [userId],
    );
    const row = (rows as ProfileRow[])[0];
    return row ? mapProfileRow(row) : null;
  },
  async listProfilesByRole(role) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT wallet_address, display_name, avatar_url, role, updated_at FROM profiles WHERE role = ? ORDER BY updated_at DESC",
      [role],
    );
    return (rows as ProfileRow[]).map(mapProfileRow);
  },
  async upsertProfile(profile) {
    const pool = await getMySqlPool();
    const createdAt = profile.updatedAt;
    await pool.execute(
      `INSERT INTO profiles (id, wallet_address, display_name, avatar_url, role, region, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         avatar_url = VALUES(avatar_url),
         role = VALUES(role),
         updated_at = VALUES(updated_at)`,
      [
        profile.userId,
        profile.userId,
        profile.displayName,
        profile.avatarUrl ?? null,
        profile.role,
        null,
        toMysqlDateTime(createdAt),
        toMysqlDateTime(profile.updatedAt),
      ],
    );
    return profile;
  },
};
