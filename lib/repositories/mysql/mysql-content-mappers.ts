import type {
  FilmCategory,
  FilmCourseRecord,
  FilmLessonRecord,
  FilmMediaAsset,
  FilmVideo,
} from "../../contracts/admin.ts";
import { buildVideoCompatibilityRecord } from "../../server/course-write-model.ts";

type SqlDateValue = string | Date;

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: SqlDateValue;
};

type CourseRow = {
  id: string;
  creator_profile_id: string | null;
  title: string;
  synopsis: string;
  year: number;
  category_id: string;
  hero_image_url: string;
  card_image_url: string;
  publish_status: "draft" | "published";
  created_at: SqlDateValue;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  synopsis: string;
  duration_min: number;
  maturity_rating: string;
  manifest_blob_key: string;
  stream_asset_id: string | null;
  publish_status: "draft" | "published";
  created_at: SqlDateValue;
};

type MediaAssetRow = {
  id: string;
  title_id: string;
  blob_key: string;
  file_name: string;
  content_type: string;
  asset_type: "manifest" | "source_video";
  ingest_status: "ready";
  created_by_user_id: string;
  created_at: SqlDateValue;
};

function toIsoString(value: SqlDateValue): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapCategoryRow(row: CategoryRow): FilmCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    createdAt: toIsoString(row.created_at),
  };
}

export function mapCourseRow(row: CourseRow): FilmCourseRecord {
  return {
    id: row.id,
    creatorProfileId: row.creator_profile_id || undefined,
    title: row.title,
    synopsis: row.synopsis,
    year: row.year,
    categoryId: row.category_id,
    heroImageUrl: row.hero_image_url,
    cardImageUrl: row.card_image_url,
    publishStatus: row.publish_status,
    createdAt: toIsoString(row.created_at),
  };
}

export function mapLessonRow(row: LessonRow): FilmLessonRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    synopsis: row.synopsis,
    durationMin: row.duration_min,
    maturityRating: row.maturity_rating,
    manifestBlobKey: row.manifest_blob_key,
    streamAssetId: row.stream_asset_id || undefined,
    publishStatus: row.publish_status,
    createdAt: toIsoString(row.created_at),
  };
}

export function mapMediaAssetRow(row: MediaAssetRow): FilmMediaAsset {
  return {
    id: row.id,
    titleId: row.title_id,
    blobKey: row.blob_key,
    fileName: row.file_name,
    contentType: row.content_type,
    assetType: row.asset_type,
    ingestStatus: row.ingest_status,
    createdByUserId: row.created_by_user_id,
    createdAt: toIsoString(row.created_at),
  };
}

export function buildVideoFromMysqlRows(courseRow: CourseRow, lessonRow: LessonRow): FilmVideo {
  return buildVideoCompatibilityRecord(mapCourseRow(courseRow), mapLessonRow(lessonRow));
}
