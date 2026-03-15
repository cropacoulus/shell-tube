export type UserRole = "user" | "admin";

export type UserProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  updatedAt: string;
};
