import test from "node:test";
import assert from "node:assert/strict";

import {
  getLessonById,
  listCourseSummaries,
  listLessonsByCourse,
} from "../lib/server/learning-read-model.ts";

const categories = [
  {
    id: "cat-romance",
    name: "Romance",
  },
];

const videos = [
  {
    id: "course-bunga",
    title: "Bunga di Taman",
    synopsis: "Cerita utama",
    year: 2026,
    durationMin: 90,
    categoryId: "cat-romance",
    heroImageUrl: "hero.jpg",
    cardImageUrl: "card.jpg",
    manifestBlobKey: "blob/master.m3u8",
    createdAt: "2026-03-16T00:00:00.000Z",
    maturityRating: "13+",
  },
];

test("listLessonsByCourse returns lesson records with courseId", () => {
  const lessons = listLessonsByCourse(videos, "course-bunga");

  assert.equal(lessons.length, 1);
  assert.equal(lessons[0]?.id, "lesson-course-bunga-main");
  assert.equal(lessons[0]?.courseId, "course-bunga");
  assert.equal(lessons[0]?.manifestBlobKey, "blob/master.m3u8");
});

test("getLessonById resolves lesson independently from course id", () => {
  const courses = listCourseSummaries(videos, categories);
  const lesson = getLessonById(videos, "lesson-course-bunga-main");

  assert.ok(courses.find((course) => course.id === "course-bunga"));
  assert.ok(lesson);
  assert.equal(lesson?.id, "lesson-course-bunga-main");
  assert.equal(lesson?.courseId, "course-bunga");
  assert.notEqual(lesson?.id, lesson?.courseId);
});
