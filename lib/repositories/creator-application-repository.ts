import type { CreatorApplicationRecord, CreatorApplicationStatus } from "@/lib/contracts/creator-application";

export type CreatorApplicationRepository = {
  listCreatorApplications(): Promise<CreatorApplicationRecord[]>;
  listCreatorApplicationsByUser(userId: string): Promise<CreatorApplicationRecord[]>;
  createCreatorApplication(
    input: Omit<CreatorApplicationRecord, "id" | "status" | "createdAt" | "updatedAt" | "reviewedByUserId" | "reviewedAt">,
  ): Promise<CreatorApplicationRecord>;
  updateCreatorApplicationStatus(
    id: string,
    input: {
      status: CreatorApplicationStatus;
      reviewedByUserId: string;
    },
  ): Promise<CreatorApplicationRecord | null>;
};
