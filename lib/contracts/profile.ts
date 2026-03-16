export type UserRole = "student" | "creator" | "admin";

export type UserProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  updatedAt: string;
};
