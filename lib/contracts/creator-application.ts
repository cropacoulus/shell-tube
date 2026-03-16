export type CreatorApplicationStatus = "pending" | "approved" | "rejected";

export type CreatorApplicationRecord = {
  id: string;
  userId: string;
  displayName: string;
  pitch: string;
  status: CreatorApplicationStatus;
  createdAt: string;
  updatedAt: string;
  reviewedByUserId?: string;
  reviewedAt?: string;
};
