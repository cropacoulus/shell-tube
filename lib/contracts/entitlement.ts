export type EntitlementRequest = {
  userId: string;
  profileId: string;
  titleId: string;
  region: string;
};

export type EntitlementResponse = {
  allowed: boolean;
  reason?: string;
  plan?: string;
};
