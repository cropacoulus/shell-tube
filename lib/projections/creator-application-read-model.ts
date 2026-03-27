import type { UserProfile } from "@/lib/contracts/profile";
import { createDefaultProjectionStore } from "@/lib/projection-store";
import type { OnChainCreatorApplicationStatus } from "@/lib/blockchain/role-registry";

const CREATOR_APPLICATIONS_KEY = "stream:projection:creator-application:all";
const CREATOR_APPLICATIONS_PENDING_KEY = "stream:projection:creator-application:index:pending";
const CREATOR_PROFILES_KEY = "stream:projection:profile:index:creators";

type CreatorApplicationProjectionRecord = {
  applicationId: string;
  userId: string;
  displayName?: string;
  pitch?: string;
  status: "pending" | "approved" | "rejected";
  reviewedByUserId?: string;
  reviewedAt?: string;
  updatedAt: string;
};

export type CreatorApplicationReadRecord = {
  id: string;
  userId: string;
  displayName: string;
  pitch: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
};

function toReadRecord(item: CreatorApplicationProjectionRecord): CreatorApplicationReadRecord {
  return {
    id: item.applicationId,
    userId: item.userId,
    displayName: item.displayName ?? `${item.userId.slice(0, 6)}...${item.userId.slice(-4)}`,
    pitch: item.pitch ?? "",
    status: item.status,
    createdAt: item.updatedAt,
    updatedAt: item.updatedAt,
    reviewedByUserId: item.reviewedByUserId,
    reviewedAt: item.reviewedAt,
  };
}

export function buildOnChainCreatorApplicationRecord(params: {
  userId: string;
  displayName?: string;
  status: OnChainCreatorApplicationStatus;
}): CreatorApplicationReadRecord | null {
  if (params.status === "none") return null;
  const timestamp = new Date(0).toISOString();
  return {
    id: `onchain_creator_app_${params.userId.toLowerCase()}`,
    userId: params.userId,
    displayName: params.displayName ?? `${params.userId.slice(0, 6)}...${params.userId.slice(-4)}`,
    pitch: "",
    status: params.status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getCreatorApplicationProjectionSnapshot() {
  const projectionStore = createDefaultProjectionStore();
  const [allApplications, pendingIds, creatorProfiles] = await Promise.all([
    projectionStore.getJson<Record<string, CreatorApplicationProjectionRecord>>(CREATOR_APPLICATIONS_KEY),
    projectionStore.getJson<string[]>(CREATOR_APPLICATIONS_PENDING_KEY),
    projectionStore.getJson<Record<string, UserProfile>>(CREATOR_PROFILES_KEY),
  ]);

  const applicationMap = allApplications ?? {};
  const pendingApplications = (pendingIds ?? [])
    .map((id) => applicationMap[id])
    .filter((item): item is CreatorApplicationProjectionRecord => Boolean(item))
    .map(toReadRecord);

  const creators = Object.values(creatorProfiles ?? {}).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

  return {
    pendingApplications,
    creators,
  };
}

export async function listCreatorApplicationsForUserFromProjection(userId: string) {
  const projectionStore = createDefaultProjectionStore();
  const allApplications =
    (await projectionStore.getJson<Record<string, CreatorApplicationProjectionRecord>>(CREATOR_APPLICATIONS_KEY)) ?? {};

  return Object.values(allApplications)
    .filter((item) => item.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toReadRecord);
}

export async function getLatestCreatorApplicationForUserFromProjection(userId: string) {
  const items = await listCreatorApplicationsForUserFromProjection(userId);
  return items[0] ?? null;
}

export async function getCreatorApplicationByIdFromProjection(applicationId: string) {
  const projectionStore = createDefaultProjectionStore();
  const allApplications =
    (await projectionStore.getJson<Record<string, CreatorApplicationProjectionRecord>>(CREATOR_APPLICATIONS_KEY)) ?? {};
  const item = allApplications[applicationId];
  if (!item) return null;
  return toReadRecord(item);
}

export async function isProjectedCreator(userId: string) {
  const projectionStore = createDefaultProjectionStore();
  const creatorProfiles =
    (await projectionStore.getJson<Record<string, UserProfile>>(CREATOR_PROFILES_KEY)) ?? {};

  return Boolean(creatorProfiles[userId]);
}
