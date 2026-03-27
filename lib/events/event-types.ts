import type { UserRole } from "@/lib/contracts/profile";

export type DomainAggregateType =
  | "category"
  | "profile"
  | "creator_application"
  | "course"
  | "lesson"
  | "media_asset"
  | "playback_session"
  | "progress"
  | "qoe"
  | "payout_ledger";

export type DomainEventType =
  | "category_created"
  | "category_updated"
  | "category_deleted"
  | "profile_created"
  | "profile_updated"
  | "creator_application_submitted"
  | "creator_application_approved"
  | "creator_application_rejected"
  | "course_created"
  | "course_updated"
  | "course_deleted"
  | "lesson_created"
  | "lesson_updated"
  | "lesson_deleted"
  | "lesson_asset_attached"
  | "lesson_processing_requested"
  | "lesson_manifest_attached"
  | "lesson_published"
  | "lesson_unpublished"
  | "media_asset_registered"
  | "playback_session_created"
  | "progress_checkpoint_recorded"
  | "lesson_completed"
  | "qoe_event_recorded"
  | "payout_projected"
  | "payout_settled";

export type DomainEventActor = {
  userId?: string;
  role?: UserRole;
};
