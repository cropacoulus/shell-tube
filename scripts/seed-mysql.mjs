import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

function normalizeRole(role) {
  if (role === "admin") return "admin";
  if (role === "creator") return "creator";
  return "student";
}

function buildMainLessonId(courseId) {
  return `lesson-${courseId}-main`;
}

function toMysqlDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeState(raw) {
  const profiles = Object.values(raw.profiles ?? {}).map((profile) => ({
    userId: profile.userId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? null,
    role: normalizeRole(profile.role),
    updatedAt: profile.updatedAt,
  }));

  const categories = raw.categories ?? [];
  const courses = raw.courses ?? [];
  const lessons = raw.lessons ?? [];
  const mediaAssets = raw.mediaAssets ?? [];

  if (courses.length > 0 && lessons.length > 0) {
    return { profiles, categories, courses, lessons, mediaAssets };
  }

  const legacyVideos = raw.videos ?? [];
  const normalizedCourses = legacyVideos.map((video) => ({
    id: video.id,
    creatorProfileId: profiles.find((profile) => profile.role === "admin")?.userId ?? null,
    title: video.title,
    synopsis: video.synopsis,
    year: video.year,
    categoryId: video.categoryId,
    heroImageUrl: video.heroImageUrl,
    cardImageUrl: video.cardImageUrl,
    publishStatus: video.publishStatus ?? "published",
    createdAt: video.createdAt,
  }));
  const normalizedLessons = legacyVideos.map((video) => ({
    id: buildMainLessonId(video.id),
    courseId: video.id,
    title: `${video.title} • Main Lesson`,
    synopsis: video.synopsis,
    durationMin: video.durationMin,
    maturityRating: video.maturityRating,
    manifestBlobKey: video.manifestBlobKey,
    streamAssetId: video.streamAssetId ?? null,
    publishStatus: video.publishStatus ?? "published",
    createdAt: video.createdAt,
  }));

  return {
    profiles,
    categories,
    courses: normalizedCourses,
    lessons: normalizedLessons,
    mediaAssets,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use mysql://");
  }

  const pool = mysql.createPool({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\/+/, ""),
  });

  const raw = JSON.parse(await readFile(new URL("../data/app-data.json", import.meta.url), "utf8"));
  const state = normalizeState(raw);

  for (const profile of state.profiles) {
    await pool.execute(
      `INSERT INTO profiles (id, wallet_address, display_name, avatar_url, role, region, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         display_name = VALUES(display_name),
         avatar_url = VALUES(avatar_url),
         role = VALUES(role),
         updated_at = VALUES(updated_at)`,
      [
        profile.userId,
        profile.userId,
        profile.displayName,
        profile.avatarUrl,
        profile.role,
        null,
        toMysqlDateTime(profile.updatedAt),
        toMysqlDateTime(profile.updatedAt),
      ],
    );
  }

  for (const category of state.categories) {
    await pool.execute(
      `INSERT INTO categories (id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         updated_at = VALUES(updated_at)`,
      [
        category.id,
        category.name,
        category.description ?? null,
        toMysqlDateTime(category.createdAt),
        toMysqlDateTime(category.createdAt),
      ],
    );
  }

  for (const course of state.courses) {
    await pool.execute(
      `INSERT INTO courses (id, creator_profile_id, category_id, title, synopsis, year, hero_image_url, card_image_url, publish_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         creator_profile_id = VALUES(creator_profile_id),
         category_id = VALUES(category_id),
         title = VALUES(title),
         synopsis = VALUES(synopsis),
         year = VALUES(year),
         hero_image_url = VALUES(hero_image_url),
         card_image_url = VALUES(card_image_url),
         publish_status = VALUES(publish_status),
         updated_at = VALUES(updated_at)`,
      [
        course.id,
        course.creatorProfileId,
        course.categoryId,
        course.title,
        course.synopsis,
        course.year,
        course.heroImageUrl,
        course.cardImageUrl,
        course.publishStatus,
        toMysqlDateTime(course.createdAt),
        toMysqlDateTime(course.createdAt),
      ],
    );
  }

  for (const lesson of state.lessons) {
    await pool.execute(
      `INSERT INTO lessons (id, course_id, title, synopsis, duration_min, maturity_rating, manifest_blob_key, stream_asset_id, publish_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         course_id = VALUES(course_id),
         title = VALUES(title),
         synopsis = VALUES(synopsis),
         duration_min = VALUES(duration_min),
         maturity_rating = VALUES(maturity_rating),
         manifest_blob_key = VALUES(manifest_blob_key),
         stream_asset_id = VALUES(stream_asset_id),
         publish_status = VALUES(publish_status),
         updated_at = VALUES(updated_at)`,
      [
        lesson.id,
        lesson.courseId,
        lesson.title,
        lesson.synopsis,
        lesson.durationMin,
        lesson.maturityRating,
        lesson.manifestBlobKey,
        lesson.streamAssetId,
        lesson.publishStatus,
        toMysqlDateTime(lesson.createdAt),
        toMysqlDateTime(lesson.createdAt),
      ],
    );
  }

  for (const asset of state.mediaAssets) {
    await pool.execute(
      `INSERT INTO media_assets (id, title_id, blob_key, file_name, content_type, asset_type, ingest_status, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         blob_key = VALUES(blob_key),
         file_name = VALUES(file_name),
         content_type = VALUES(content_type),
         asset_type = VALUES(asset_type),
         ingest_status = VALUES(ingest_status),
         created_by_user_id = VALUES(created_by_user_id)`,
      [
        asset.id,
        asset.titleId,
        asset.blobKey,
        asset.fileName,
        asset.contentType,
        asset.assetType,
        asset.ingestStatus,
        asset.createdByUserId,
        toMysqlDateTime(asset.createdAt),
      ],
    );
  }

  await pool.end();
  console.log(
    JSON.stringify({
      ok: true,
      profiles: state.profiles.length,
      categories: state.categories.length,
      courses: state.courses.length,
      lessons: state.lessons.length,
      mediaAssets: state.mediaAssets.length,
    }),
  );
}

await main();
