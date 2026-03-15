import type { UserRole } from "@/lib/contracts/profile";

export type SessionClaims = {
  sub: string;
  profileId: string;
  region: string;
  sessionId: string;
  role: UserRole;
  iat: number;
  exp: number;
};

export type AuthContext = {
  userId: string;
  profileId: string;
  region: string;
  sessionId: string;
  role: UserRole;
};
