import type { FilmVideo, MediaAssetType, VideoPublishStatus } from "@/lib/contracts/admin";

type InferAssetTypeParams = {
  fileName: string;
  folder?: string;
  contentType?: string;
};

export const normalizeVideoRecord = (
  video: Omit<FilmVideo, "publishStatus"> & { publishStatus?: string | null },
): FilmVideo => {
  const publishStatus: VideoPublishStatus =
    video.publishStatus === "draft" || video.publishStatus === "published"
      ? video.publishStatus
      : "published";

  return {
    ...video,
    publishStatus,
  };
};

export const isPublishedVideo = (video: Pick<FilmVideo, "publishStatus">): boolean => {
  return video.publishStatus === "published";
};

export const inferAssetType = (params: InferAssetTypeParams): MediaAssetType => {
  const normalizedName = params.fileName.toLowerCase();
  const normalizedFolder = params.folder?.toLowerCase() ?? "";
  const normalizedContentType = params.contentType?.toLowerCase() ?? "";

  if (
    normalizedName.endsWith(".m3u8") ||
    normalizedFolder.includes("manifest") ||
    normalizedContentType.includes("mpegurl")
  ) {
    return "manifest";
  }

  return "source_video";
};
