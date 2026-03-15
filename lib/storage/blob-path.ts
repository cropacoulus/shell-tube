export function sanitizeBlobPathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

export function buildTitleBlobName(params: {
  titleId: string;
  folder: string;
  fileName: string;
}) {
  const safeTitleId = sanitizeBlobPathSegment(params.titleId);
  const safeFolder = sanitizeBlobPathSegment(params.folder);
  const safeFileName = sanitizeBlobPathSegment(params.fileName);
  return `titles/${safeTitleId}/${safeFolder}/${safeFileName}`;
}
