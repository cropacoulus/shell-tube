import test from "node:test";
import assert from "node:assert/strict";

import { createRepositoryRegistry } from "../lib/repositories/repository-registry.ts";

test("repository registry returns defaults and can be overridden", async () => {
  const registry = createRepositoryRegistry({
    activityRepository: {
      listLessonProgressByUser: async (userId: string) => {
        void userId;
        return [{ id: "prog_1" }];
      },
    },
    contentRepository: {
      listCategories: async () => [{ id: "cat_1" }],
    },
    profileRepository: {
      getProfile: async () => ({ userId: "user_1" }),
      listProfilesByRole: async (role: string) => [{ userId: `creator_for_${role}`, role: "creator" }],
    },
    revenueRepository: {
      listCreatorPayoutLedger: async () => [{ id: "ledger_1" }],
    },
    creatorApplicationRepository: {
      listCreatorApplications: async () => [{ id: "app_1" }],
    },
    eventStore: {
      listEvents: async () => [{ id: "evt_1" }],
    },
  });

  assert.equal(typeof registry.getContentRepository().listCategories, "function");
  assert.equal(typeof registry.getProfileRepository().getProfile, "function");
  assert.equal(typeof registry.getProfileRepository().listProfilesByRole, "function");
  assert.equal(typeof registry.getActivityRepository().listLessonProgressByUser, "function");
  assert.equal(typeof registry.getRevenueRepository().listCreatorPayoutLedger, "function");
  assert.equal(typeof registry.getCreatorApplicationRepository().listCreatorApplications, "function");
  assert.equal(typeof registry.getEventStore().listEvents, "function");

  const categories = await registry.getContentRepository().listCategories();
  assert.ok(Array.isArray(categories));
  const progress = await registry.getActivityRepository().listLessonProgressByUser("user_1");
  assert.ok(Array.isArray(progress));
  const creators = await registry.getProfileRepository().listProfilesByRole("creator");
  assert.ok(Array.isArray(creators));
  const ledger = await registry.getRevenueRepository().listCreatorPayoutLedger();
  assert.ok(Array.isArray(ledger));
  const applications = await registry.getCreatorApplicationRepository().listCreatorApplications();
  assert.ok(Array.isArray(applications));
  const events = await registry.getEventStore().listEvents();
  assert.ok(Array.isArray(events));

  registry.setRepositories({
    activityRepository: {
      listLessonProgressByUser: async (userId: string) => {
        void userId;
        return [{ id: "prog_2" }];
      },
    },
    contentRepository: {
      listCategories: async () => [{ id: "cat_2" }],
    },
    profileRepository: {
      getProfile: async () => ({ userId: "user_1" }),
      listProfilesByRole: async (role: string) => [{ userId: `creator_2_${role}`, role: "creator" }],
    },
    revenueRepository: {
      listCreatorPayoutLedger: async () => [{ id: "ledger_2" }],
    },
    creatorApplicationRepository: {
      listCreatorApplications: async () => [{ id: "app_2" }],
    },
    eventStore: {
      listEvents: async () => [{ id: "evt_2" }],
    },
  });

  const updatedCategories = await registry.getContentRepository().listCategories();
  assert.equal(updatedCategories[0]?.id, "cat_2");
  const updatedProgress = await registry.getActivityRepository().listLessonProgressByUser("user_1");
  assert.equal(updatedProgress[0]?.id, "prog_2");
  const updatedCreators = await registry.getProfileRepository().listProfilesByRole("creator");
  assert.equal(updatedCreators[0]?.userId, "creator_2_creator");
  const updatedLedger = await registry.getRevenueRepository().listCreatorPayoutLedger();
  assert.equal(updatedLedger[0]?.id, "ledger_2");
  const updatedApplications = await registry.getCreatorApplicationRepository().listCreatorApplications();
  assert.equal(updatedApplications[0]?.id, "app_2");
  const updatedEvents = await registry.getEventStore().listEvents();
  assert.equal(updatedEvents[0]?.id, "evt_2");
});
