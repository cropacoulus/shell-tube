type CreatorContentCoreInput = {
  title: string;
  synopsis: string;
  year: number;
  categoryId: string;
  durationMin: number;
  maturityRating: string;
};

export function validateCreatorContentCore(input: CreatorContentCoreInput) {
  if (!input.title.trim()) return "Course title is required.";
  if (!input.synopsis.trim()) return "Course synopsis is required.";
  if (!input.categoryId.trim()) return "Category is required.";
  if (!input.maturityRating.trim()) return "Audience rating is required.";
  if (!Number.isFinite(input.year) || input.year < 1900 || input.year > new Date().getFullYear() + 5) {
    return "Release year is invalid.";
  }
  if (!Number.isFinite(input.durationMin) || input.durationMin <= 0) {
    return "Lesson duration must be greater than zero.";
  }
  return null;
}

export function validateCreatorPublishState(input: {
  publishStatus: "draft" | "published";
  manifestBlobKey?: string | null;
}) {
  if (input.publishStatus === "published" && !input.manifestBlobKey?.trim()) {
    return "Published lessons require a manifest blob key.";
  }
  return null;
}
