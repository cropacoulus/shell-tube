import type { CreatorApplicationRepository } from "@/lib/repositories/creator-application-repository";
import {
  createCreatorApplication,
  listCreatorApplications,
  listCreatorApplicationsByUser,
  updateCreatorApplicationStatus,
} from "@/lib/server/data-store";

export const jsonCreatorApplicationRepository: CreatorApplicationRepository = {
  listCreatorApplications,
  listCreatorApplicationsByUser,
  createCreatorApplication,
  updateCreatorApplicationStatus,
};
