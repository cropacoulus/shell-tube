export function createRepositoryRegistry<TContentRepository, TProfileRepository, TActivityRepository, TRevenueRepository, TCreatorApplicationRepository, TEventStore>(
  defaults: {
    contentRepository: TContentRepository;
    profileRepository: TProfileRepository;
    activityRepository: TActivityRepository;
    revenueRepository: TRevenueRepository;
    creatorApplicationRepository: TCreatorApplicationRepository;
    eventStore: TEventStore;
  },
) {
  let contentRepository = defaults.contentRepository;
  let profileRepository = defaults.profileRepository;
  let activityRepository = defaults.activityRepository;
  let revenueRepository = defaults.revenueRepository;
  let creatorApplicationRepository = defaults.creatorApplicationRepository;
  let eventStore = defaults.eventStore;

  return {
    getContentRepository() {
      return contentRepository;
    },
    getProfileRepository() {
      return profileRepository;
    },
    getActivityRepository() {
      return activityRepository;
    },
    getRevenueRepository() {
      return revenueRepository;
    },
    getCreatorApplicationRepository() {
      return creatorApplicationRepository;
    },
    getEventStore() {
      return eventStore;
    },
    setRepositories(input: {
      contentRepository?: TContentRepository;
      profileRepository?: TProfileRepository;
      activityRepository?: TActivityRepository;
      revenueRepository?: TRevenueRepository;
      creatorApplicationRepository?: TCreatorApplicationRepository;
      eventStore?: TEventStore;
    }) {
      if (input.contentRepository) {
        contentRepository = input.contentRepository;
      }
      if (input.profileRepository) {
        profileRepository = input.profileRepository;
      }
      if (input.activityRepository) {
        activityRepository = input.activityRepository;
      }
      if (input.revenueRepository) {
        revenueRepository = input.revenueRepository;
      }
      if (input.creatorApplicationRepository) {
        creatorApplicationRepository = input.creatorApplicationRepository;
      }
      if (input.eventStore) {
        eventStore = input.eventStore;
      }
    },
  };
}
