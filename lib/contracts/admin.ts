export type FilmCategory = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export type VideoPublishStatus = "draft" | "published";
export type LessonProcessingStatus = "idle" | "source_uploaded" | "packaging_requested" | "manifest_ready";

export type MediaAssetType = "manifest" | "source_video";

export type FilmMediaAsset = {
  id: string;
  titleId: string;
  blobKey: string;
  fileName: string;
  contentType: string;
  assetType: MediaAssetType;
  ingestStatus: "ready";
  createdByUserId: string;
  createdAt: string;
};

export type FilmCourseRecord = {
  id: string;
  creatorProfileId?: string;
  title: string;
  synopsis: string;
  year: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  publishStatus: VideoPublishStatus;
  createdAt: string;
};

export type FilmLessonRecord = {
  id: string;
  courseId: string;
  title: string;
  synopsis: string;
  durationMin: number;
  maturityRating: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  processingStatus?: LessonProcessingStatus;
  publishStatus: VideoPublishStatus;
  createdAt: string;
};

export type FilmVideo = {
  id: string;
  title: string;
  synopsis: string;
  year: number;
  maturityRating: string;
  durationMin: number;
  categoryId: string;
  heroImageUrl: string;
  cardImageUrl: string;
  manifestBlobKey: string;
  streamAssetId?: string;
  publishStatus: VideoPublishStatus;
  createdAt: string;
};
