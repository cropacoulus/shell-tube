export function createRepositoryRegistry<TContentRepository, TProfileRepository, TActivityRepository, TRevenueRepository, TCreatorApplicationRepository>(
  defaults: {
    contentRepository: TContentRepository;
    profileRepository: TProfileRepository;
    activityRepository: TActivityRepository;
    revenueRepository: TRevenueRepository;
    creatorApplicationRepository: TCreatorApplicationRepository;
  },
) {
  let contentRepository = defaults.contentRepository;
  let profileRepository = defaults.profileRepository;
  let activityRepository = defaults.activityRepository;
  let revenueRepository = defaults.revenueRepository;
  let creatorApplicationRepository = defaults.creatorApplicationRepository;

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
    setRepositories(input: {
      contentRepository?: TContentRepository;
      profileRepository?: TProfileRepository;
      activityRepository?: TActivityRepository;
      revenueRepository?: TRevenueRepository;
      creatorApplicationRepository?: TCreatorApplicationRepository;
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
    },
  };
}
