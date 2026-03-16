import type { ContentRepository } from "@/lib/repositories/content-repository";
import type {
  FilmCategory,
  FilmCourseRecord,
  FilmLessonRecord,
  FilmMediaAsset,
  FilmVideo,
} from "@/lib/contracts/admin";
import { getMySqlPool } from "@/lib/repositories/mysql/mysql-connection";
import { toMysqlDateTime } from "@/lib/repositories/mysql/mysql-datetime";
import { buildVideoFromMysqlRows, mapCategoryRow, mapCourseRow, mapLessonRow, mapMediaAssetRow } from "@/lib/repositories/mysql/mysql-content-mappers";
import { buildMainLessonInput } from "@/lib/server/course-write-model";

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string | Date;
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
  created_at: string | Date;
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
  created_at: string | Date;
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
  created_at: string | Date;
};

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

async function getCategoryById(id: string): Promise<FilmCategory | null> {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    "SELECT id, name, description, created_at FROM categories WHERE id = ? LIMIT 1",
    [id],
  );
  const row = (rows as CategoryRow[])[0];
  return row ? mapCategoryRow(row) : null;
}

async function getCourseRowById(id: string): Promise<CourseRow | null> {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    "SELECT id, creator_profile_id, title, synopsis, year, category_id, hero_image_url, card_image_url, publish_status, created_at FROM courses WHERE id = ? LIMIT 1",
    [id],
  );
  return ((rows as CourseRow[])[0] ?? null) as CourseRow | null;
}

async function getLessonRowById(id: string): Promise<LessonRow | null> {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    "SELECT id, course_id, title, synopsis, duration_min, maturity_rating, manifest_blob_key, stream_asset_id, publish_status, created_at FROM lessons WHERE id = ? LIMIT 1",
    [id],
  );
  return ((rows as LessonRow[])[0] ?? null) as LessonRow | null;
}

async function getFirstLessonRowByCourseId(courseId: string): Promise<LessonRow | null> {
  const pool = await getMySqlPool();
  const [rows] = await pool.execute(
    "SELECT id, course_id, title, synopsis, duration_min, maturity_rating, manifest_blob_key, stream_asset_id, publish_status, created_at FROM lessons WHERE course_id = ? ORDER BY created_at ASC LIMIT 1",
    [courseId],
  );
  return ((rows as LessonRow[])[0] ?? null) as LessonRow | null;
}

export const mysqlContentRepository: ContentRepository = {
  async listCategories() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, name, description, created_at FROM categories ORDER BY created_at DESC",
    );
    return (rows as CategoryRow[]).map(mapCategoryRow);
  },
  async addCategory(input) {
    const pool = await getMySqlPool();
    const category: FilmCategory = {
      id: generateId("cat"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    await pool.execute(
      "INSERT INTO categories (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [
        category.id,
        category.name,
        category.description ?? null,
        toMysqlDateTime(category.createdAt),
        toMysqlDateTime(category.createdAt),
      ],
    );
    return category;
  },
  async updateCategory(id, patch) {
    const pool = await getMySqlPool();
    const fields: string[] = [];
    const params: unknown[] = [];
    if (typeof patch.name === "string") {
      fields.push("name = ?");
      params.push(patch.name);
    }
    if (typeof patch.description === "string") {
      fields.push("description = ?");
      params.push(patch.description);
    }
    if (fields.length === 0) return getCategoryById(id);
    fields.push("updated_at = ?");
    params.push(toMysqlDateTime(new Date()), id);
    await pool.execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, params);
    const [rows] = await pool.execute(
      "SELECT id, name, description, created_at FROM categories WHERE id = ? LIMIT 1",
      [id],
    );
    const row = (rows as CategoryRow[])[0];
    return row ? mapCategoryRow(row) : null;
  },
  async deleteCategory(id) {
    const pool = await getMySqlPool();
    const [courseRows] = await pool.execute("SELECT id FROM courses WHERE category_id = ? LIMIT 1", [id]);
    if (Array.isArray(courseRows) && courseRows.length > 0) {
      return { ok: false, reason: "Category is used by one or more videos" };
    }
    const [result] = await pool.execute("DELETE FROM categories WHERE id = ?", [id]);
    const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
    if (affectedRows === 0) {
      return { ok: false, reason: "Category not found" };
    }
    return { ok: true };
  },
  async listVideos() {
    const pool = await getMySqlPool();
    const [courseRows, lessonRows] = await Promise.all([
      pool.execute(
        "SELECT id, creator_profile_id, title, synopsis, year, category_id, hero_image_url, card_image_url, publish_status, created_at FROM courses ORDER BY created_at DESC",
      ),
      pool.execute(
        "SELECT id, course_id, title, synopsis, duration_min, maturity_rating, manifest_blob_key, stream_asset_id, publish_status, created_at FROM lessons ORDER BY created_at ASC",
      ),
    ]);
    const lessonsByCourseId = new Map(
      (lessonRows[0] as LessonRow[]).map((row) => [row.course_id, row] as const),
    );
    return (courseRows[0] as CourseRow[])
      .map((courseRow) => {
        const lessonRow = lessonsByCourseId.get(courseRow.id);
        return lessonRow ? buildVideoFromMysqlRows(courseRow, lessonRow) : null;
      })
      .filter((item): item is FilmVideo => Boolean(item));
  },
  async addVideo(input) {
    const course = await mysqlContentRepository.addCourseRecord({
      creatorProfileId: undefined,
      title: input.title,
      synopsis: input.synopsis,
      year: input.year,
      categoryId: input.categoryId,
      heroImageUrl: input.heroImageUrl,
      cardImageUrl: input.cardImageUrl,
      publishStatus: input.publishStatus,
    });
    const lesson = await mysqlContentRepository.addLessonRecord(
      buildMainLessonInput({
        id: course.id,
        title: input.title,
        synopsis: input.synopsis,
        durationMin: input.durationMin,
        maturityRating: input.maturityRating,
        manifestBlobKey: input.manifestBlobKey,
        streamAssetId: input.streamAssetId,
        publishStatus: input.publishStatus,
        createdAt: course.createdAt,
      }),
    );
    return {
      id: course.id,
      title: course.title,
      synopsis: course.synopsis,
      year: course.year,
      maturityRating: lesson.maturityRating,
      durationMin: lesson.durationMin,
      categoryId: course.categoryId,
      heroImageUrl: course.heroImageUrl,
      cardImageUrl: course.cardImageUrl,
      manifestBlobKey: lesson.manifestBlobKey,
      streamAssetId: lesson.streamAssetId,
      publishStatus:
        course.publishStatus === "draft" || lesson.publishStatus === "draft" ? "draft" : "published",
      createdAt: course.createdAt,
    };
  },
  async updateVideo(id, patch) {
    const lesson = await getFirstLessonRowByCourseId(id);
    if (!lesson) return null;
    const [updatedCourse, updatedLesson] = await Promise.all([
      mysqlContentRepository.updateCourseRecord(id, {
        ...(typeof patch.title === "string" ? { title: patch.title } : {}),
        ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
        ...(typeof patch.year === "number" ? { year: patch.year } : {}),
        ...(typeof patch.categoryId === "string" ? { categoryId: patch.categoryId } : {}),
        ...(typeof patch.heroImageUrl === "string" ? { heroImageUrl: patch.heroImageUrl } : {}),
        ...(typeof patch.cardImageUrl === "string" ? { cardImageUrl: patch.cardImageUrl } : {}),
        ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
      }),
      mysqlContentRepository.updateLessonRecord(lesson.id, {
        ...(typeof patch.title === "string" ? { title: `${patch.title} • Main Lesson` } : {}),
        ...(typeof patch.synopsis === "string" ? { synopsis: patch.synopsis } : {}),
        ...(typeof patch.durationMin === "number" ? { durationMin: patch.durationMin } : {}),
        ...(typeof patch.maturityRating === "string" ? { maturityRating: patch.maturityRating } : {}),
        ...(typeof patch.manifestBlobKey === "string" ? { manifestBlobKey: patch.manifestBlobKey } : {}),
        ...(typeof patch.streamAssetId === "string" ? { streamAssetId: patch.streamAssetId } : {}),
        ...(patch.publishStatus ? { publishStatus: patch.publishStatus } : {}),
      }),
    ]);
    return updatedCourse && updatedLesson
      ? {
          id: updatedCourse.id,
          title: updatedCourse.title,
          synopsis: updatedCourse.synopsis,
          year: updatedCourse.year,
          maturityRating: updatedLesson.maturityRating,
          durationMin: updatedLesson.durationMin,
          categoryId: updatedCourse.categoryId,
          heroImageUrl: updatedCourse.heroImageUrl,
          cardImageUrl: updatedCourse.cardImageUrl,
          manifestBlobKey: updatedLesson.manifestBlobKey,
          streamAssetId: updatedLesson.streamAssetId,
          publishStatus:
            updatedCourse.publishStatus === "draft" || updatedLesson.publishStatus === "draft"
              ? "draft"
              : "published",
          createdAt: updatedCourse.createdAt,
        }
      : null;
  },
  async deleteVideo(id) {
    return mysqlContentRepository.deleteCourseRecord(id);
  },
  async listCourseRecords() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, creator_profile_id, title, synopsis, year, category_id, hero_image_url, card_image_url, publish_status, created_at FROM courses ORDER BY created_at DESC",
    );
    return (rows as CourseRow[]).map(mapCourseRow);
  },
  async addCourseRecord(input) {
    const pool = await getMySqlPool();
    const course: FilmCourseRecord = {
      id: generateId("vid"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    await pool.execute(
      "INSERT INTO courses (id, creator_profile_id, category_id, title, synopsis, year, hero_image_url, card_image_url, publish_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        course.id,
        course.creatorProfileId ?? null,
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
    return course;
  },
  async getCourseRecordById(id) {
    const row = await getCourseRowById(id);
    return row ? mapCourseRow(row) : null;
  },
  async updateCourseRecord(id, patch) {
    const pool = await getMySqlPool();
    const fields: string[] = [];
    const params: unknown[] = [];
    if (typeof patch.title === "string") {
      fields.push("title = ?");
      params.push(patch.title);
    }
    if (typeof patch.creatorProfileId === "string") {
      fields.push("creator_profile_id = ?");
      params.push(patch.creatorProfileId);
    }
    if (typeof patch.synopsis === "string") {
      fields.push("synopsis = ?");
      params.push(patch.synopsis);
    }
    if (typeof patch.year === "number") {
      fields.push("year = ?");
      params.push(patch.year);
    }
    if (typeof patch.categoryId === "string") {
      fields.push("category_id = ?");
      params.push(patch.categoryId);
    }
    if (typeof patch.heroImageUrl === "string") {
      fields.push("hero_image_url = ?");
      params.push(patch.heroImageUrl);
    }
    if (typeof patch.cardImageUrl === "string") {
      fields.push("card_image_url = ?");
      params.push(patch.cardImageUrl);
    }
    if (patch.publishStatus) {
      fields.push("publish_status = ?");
      params.push(patch.publishStatus);
    }
    if (fields.length === 0) return mysqlContentRepository.getCourseRecordById(id);
    fields.push("updated_at = ?");
    params.push(toMysqlDateTime(new Date()), id);
    await pool.execute(`UPDATE courses SET ${fields.join(", ")} WHERE id = ?`, params);
    return mysqlContentRepository.getCourseRecordById(id);
  },
  async deleteCourseRecord(id) {
    const pool = await getMySqlPool();
    const lessonIds = (await mysqlContentRepository.listLessonRecordsByCourse(id)).map((lesson) => lesson.id);
    if (lessonIds.length > 0) {
      const placeholders = lessonIds.map(() => "?").join(", ");
      await pool.execute(`DELETE FROM media_assets WHERE title_id IN (${placeholders})`, lessonIds);
    }
    await pool.execute("DELETE FROM lessons WHERE course_id = ?", [id]);
    const [result] = await pool.execute("DELETE FROM courses WHERE id = ?", [id]);
    return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
  },
  async listLessonRecords() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, course_id, title, synopsis, duration_min, maturity_rating, manifest_blob_key, stream_asset_id, publish_status, created_at FROM lessons ORDER BY created_at ASC",
    );
    return (rows as LessonRow[]).map(mapLessonRow);
  },
  async addLessonRecord(input) {
    const pool = await getMySqlPool();
    const lesson: FilmLessonRecord = {
      id: generateId("lesson"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    await pool.execute(
      "INSERT INTO lessons (id, course_id, title, synopsis, duration_min, maturity_rating, manifest_blob_key, stream_asset_id, publish_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        lesson.id,
        lesson.courseId,
        lesson.title,
        lesson.synopsis,
        lesson.durationMin,
        lesson.maturityRating,
        lesson.manifestBlobKey,
        lesson.streamAssetId ?? null,
        lesson.publishStatus,
        toMysqlDateTime(lesson.createdAt),
        toMysqlDateTime(lesson.createdAt),
      ],
    );
    return lesson;
  },
  async listLessonRecordsByCourse(courseId) {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, course_id, title, synopsis, duration_min, maturity_rating, manifest_blob_key, stream_asset_id, publish_status, created_at FROM lessons WHERE course_id = ? ORDER BY created_at ASC",
      [courseId],
    );
    return (rows as LessonRow[]).map(mapLessonRow);
  },
  async getLessonRecordById(id) {
    const row = await getLessonRowById(id);
    return row ? mapLessonRow(row) : null;
  },
  async updateLessonRecord(id, patch) {
    const pool = await getMySqlPool();
    const fields: string[] = [];
    const params: unknown[] = [];
    if (typeof patch.title === "string") {
      fields.push("title = ?");
      params.push(patch.title);
    }
    if (typeof patch.synopsis === "string") {
      fields.push("synopsis = ?");
      params.push(patch.synopsis);
    }
    if (typeof patch.durationMin === "number") {
      fields.push("duration_min = ?");
      params.push(patch.durationMin);
    }
    if (typeof patch.maturityRating === "string") {
      fields.push("maturity_rating = ?");
      params.push(patch.maturityRating);
    }
    if (typeof patch.manifestBlobKey === "string") {
      fields.push("manifest_blob_key = ?");
      params.push(patch.manifestBlobKey);
    }
    if (typeof patch.streamAssetId === "string") {
      fields.push("stream_asset_id = ?");
      params.push(patch.streamAssetId);
    }
    if (patch.publishStatus) {
      fields.push("publish_status = ?");
      params.push(patch.publishStatus);
    }
    if (fields.length === 0) return mysqlContentRepository.getLessonRecordById(id);
    fields.push("updated_at = ?");
    params.push(toMysqlDateTime(new Date()), id);
    await pool.execute(`UPDATE lessons SET ${fields.join(", ")} WHERE id = ?`, params);
    return mysqlContentRepository.getLessonRecordById(id);
  },
  async deleteLessonRecord(id) {
    const pool = await getMySqlPool();
    await pool.execute("DELETE FROM media_assets WHERE title_id = ?", [id]);
    const [result] = await pool.execute("DELETE FROM lessons WHERE id = ?", [id]);
    return Number((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
  },
  async listMediaAssets() {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(
      "SELECT id, title_id, blob_key, file_name, content_type, asset_type, ingest_status, created_by_user_id, created_at FROM media_assets ORDER BY created_at DESC",
    );
    return (rows as MediaAssetRow[]).map(mapMediaAssetRow);
  },
  async addMediaAsset(input) {
    const pool = await getMySqlPool();
    const asset: FilmMediaAsset = {
      id: generateId("asset"),
      createdAt: new Date().toISOString(),
      ...input,
    };
    await pool.execute(
      "INSERT INTO media_assets (id, title_id, blob_key, file_name, content_type, asset_type, ingest_status, created_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    return asset;
  },
};
