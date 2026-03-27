import type { ActivityRepository } from "@/lib/repositories/activity-repository";
import type { EventStore } from "@/lib/event-store/event-store";
import { createDefaultEventStore } from "@/lib/event-store";
import { jsonActivityRepository } from "@/lib/repositories/json/json-activity-repository";
import type { ContentRepository } from "@/lib/repositories/content-repository";
import type { ProfileRepository } from "@/lib/repositories/profile-repository";
import type { RevenueRepository } from "@/lib/repositories/revenue-repository";
import type { CreatorApplicationRepository } from "@/lib/repositories/creator-application-repository";
import { jsonCreatorApplicationRepository } from "@/lib/repositories/json/json-creator-application-repository";
import { jsonContentRepository } from "@/lib/repositories/json/json-content-repository";
import { jsonProfileRepository } from "@/lib/repositories/json/json-profile-repository";
import { jsonRevenueRepository } from "@/lib/repositories/json/json-revenue-repository";
import { mysqlCreatorApplicationRepository } from "@/lib/repositories/mysql/mysql-creator-application-repository";
import { mysqlActivityRepository } from "@/lib/repositories/mysql/mysql-activity-repository";
import { mysqlContentRepository } from "@/lib/repositories/mysql/mysql-content-repository";
import { mysqlProfileRepository } from "@/lib/repositories/mysql/mysql-profile-repository";
import { mysqlRevenueRepository } from "@/lib/repositories/mysql/mysql-revenue-repository";
import { createPersistenceConfig } from "@/lib/repositories/persistence-config";
import { createRepositoryRegistry } from "@/lib/repositories/repository-registry";

function createDefaultRepositories(): {
  activityRepository: ActivityRepository;
  contentRepository: ContentRepository;
  profileRepository: ProfileRepository;
  revenueRepository: RevenueRepository;
  creatorApplicationRepository: CreatorApplicationRepository;
  eventStore: EventStore;
} {
  const config = createPersistenceConfig();
  if (config.driver === "mysql") {
    return {
      activityRepository: mysqlActivityRepository,
      contentRepository: mysqlContentRepository,
      profileRepository: mysqlProfileRepository,
      revenueRepository: mysqlRevenueRepository,
      creatorApplicationRepository: mysqlCreatorApplicationRepository,
      eventStore: createDefaultEventStore(),
    };
  }
  return {
    activityRepository: jsonActivityRepository,
    contentRepository: jsonContentRepository,
    profileRepository: jsonProfileRepository,
    revenueRepository: jsonRevenueRepository,
    creatorApplicationRepository: jsonCreatorApplicationRepository,
    eventStore: createDefaultEventStore(),
  };
}

const registry = createRepositoryRegistry<ContentRepository, ProfileRepository, ActivityRepository, RevenueRepository, CreatorApplicationRepository, EventStore>(
  createDefaultRepositories(),
);

export const getActivityRepository = registry.getActivityRepository;
export const getContentRepository = registry.getContentRepository;
export const getProfileRepository = registry.getProfileRepository;
export const getRevenueRepository = registry.getRevenueRepository;
export const getCreatorApplicationRepository = registry.getCreatorApplicationRepository;
export const getEventStore = registry.getEventStore;
export const setRepositories = registry.setRepositories;
