export type EntitlementRequest = {
  userId: string;
  profileId: string;
  titleId: string;
  lessonId?: string;
  region: string;
};

export type EntitlementResponse = {
  allowed: boolean;
  reason?: string;
  plan?: string;
};
