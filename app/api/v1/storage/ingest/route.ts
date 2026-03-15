import { getAuthContextFromRequest } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { ServiceError } from "@/lib/services/http-client";
import { putShelbyBlob } from "@/lib/services/shelby-storage-client";
import { isAptosAddress } from "@/lib/auth/wallet";
import { buildTitleBlobName } from "@/lib/storage/blob-path";

type IngestRequest = {
  titleId: string;
  fileName: string;
  contentType: string;
  dataBase64: string;
  folder?: string;
};

function isValid(body: unknown): body is IngestRequest {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.titleId === "string" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.contentType === "string" &&
    typeof candidate.dataBase64 === "string"
  );
}

function isFormFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string") return false;
  return typeof value.arrayBuffer === "function" && typeof value.name === "string";
}

export async function POST(req: Request) {
  const auth = getAuthContextFromRequest(req);
  if (!auth) {
    return jsonError("UNAUTHORIZED", "Session is required", 401);
  }
  if (auth.role !== "admin") {
    return jsonError("FORBIDDEN", "Admin access required", 403);
  }
  if (!isAptosAddress(auth.userId)) {
    return jsonError("UNAUTHORIZED", "Admin session wallet address is invalid", 401);
  }

  try {
    let titleId = "";
    let folder = "sources";
    let fileName = "";
    let contentType = "application/octet-stream";
    let binary = new Uint8Array();

    const contentTypeHeader = req.headers.get("content-type") || "";
    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!isFormFile(file)) {
        return jsonError("INVALID_REQUEST", "file is required", 422);
      }
      titleId = String(form.get("titleId") || "");
      folder = String(form.get("folder") || "sources");
      fileName = file.name;
      contentType = String(form.get("contentType") || file.type || "application/octet-stream");
      binary = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = (await req.json().catch(() => null)) as unknown;
      if (!isValid(body)) {
        return jsonError("INVALID_REQUEST", "Invalid ingest payload", 422);
      }
      titleId = body.titleId;
      folder = body.folder || "sources";
      fileName = body.fileName;
      contentType = body.contentType;
      binary = new Uint8Array(Buffer.from(body.dataBase64, "base64"));
    }

    if (!titleId || !fileName) {
      return jsonError("INVALID_REQUEST", "titleId and file are required", 422);
    }

    const blobKey = buildTitleBlobName({ titleId, folder, fileName });
    const response = await putShelbyBlob({
      accountAddress: auth.userId,
      blobName: blobKey,
      contentType,
      data: binary,
    });

    return jsonOk(response, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }
    const debugMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonError(
      "INTERNAL_ERROR",
      process.env.NODE_ENV === "production"
        ? "Unable to ingest into Shelby storage"
        : `Unable to ingest into Shelby storage: ${debugMessage}`,
      500,
    );
  }
}
