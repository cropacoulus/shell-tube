export function validateCreatorPublishState(input: {
  publishStatus: "draft" | "published";
  manifestBlobKey?: string | null;
}) {
  if (input.publishStatus === "published" && !input.manifestBlobKey?.trim()) {
    return "Published lessons require a manifest blob key.";
  }
  return null;
}
