type CreatorContentCoreInput = {
  title: string;
  synopsis: string;
  categoryId: string;
  durationMin: number;
};

export type CreatorContentFieldErrors = Partial<Record<keyof CreatorContentCoreInput, string>>;

export function getCreatorContentFieldErrors(input: CreatorContentCoreInput): CreatorContentFieldErrors {
  const errors: CreatorContentFieldErrors = {};

  if (!input.title.trim()) errors.title = "Course title is required.";
  if (!input.synopsis.trim()) errors.synopsis = "Course synopsis is required.";
  if (!input.categoryId.trim()) errors.categoryId = "Category is required.";
  if (!Number.isFinite(input.durationMin) || input.durationMin <= 0) {
    errors.durationMin = "Lesson duration must be greater than zero.";
  }

  return errors;
}

export function validateCreatorContentCore(input: CreatorContentCoreInput) {
  const errors = getCreatorContentFieldErrors(input);
  return Object.values(errors)[0] ?? null;
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
