import { canPublishContent } from "@/lib/auth/capabilities";
import type { FilmMediaAsset } from "@/lib/contracts/admin";
import type { DomainEvent } from "@/lib/events/contracts";
import { createDomainEvent } from "@/lib/events/event-factory";
import { buildEventIdempotencyKey } from "@/lib/events/idempotency";
import { runProjectionBatch } from "@/lib/jobs/projection-runner";
import { getLessonFromProjection } from "@/lib/projections/lesson-read-model";
import { getContentRepository, getEventStore } from "@/lib/repositories";
import { createOptionBConfig } from "@/lib/runtime/option-b-config";
import { inferAssetType } from "@/lib/server/publishing-model";
import { getAuthContextFromRequestOrBearer } from "@/lib/server/auth";
import { getEffectiveUserRole } from "@/lib/server/effective-role";
import { jsonError, jsonOk } from "@/lib/server/http";
import { requireWalletActionProof } from "@/lib/server/wallet-action-auth";
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
  const auth = await getAuthContextFromRequestOrBearer(req);
  if (!auth) {
    return jsonError("UNAUTHORIZED", "Session is required", 401);
  }
  const proof = await requireWalletActionProof(req, auth.userId);
  if (!proof.ok) return proof.response;
  const effectiveRole = await getEffectiveUserRole({
    userId: auth.userId,
    fallbackRole: auth.role,
  });
  if (!canPublishContent(effectiveRole)) {
    return jsonError("FORBIDDEN", "Creator or admin access required", 403);
  }
  if (!isAptosAddress(auth.userId)) {
    return jsonError("UNAUTHORIZED", "Publisher session wallet address is invalid", 401);
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

    const optionB = createOptionBConfig();
    const assetType = inferAssetType({ fileName, folder, contentType });
    const asset: FilmMediaAsset = optionB.projectionStoreBackend === "upstash"
      ? {
          id: `asset_${crypto.randomUUID().slice(0, 12)}`,
          titleId,
          blobKey: response.blobKey,
          fileName,
          contentType,
          assetType,
          ingestStatus: "ready",
          createdByUserId: auth.userId,
          createdAt: new Date().toISOString(),
        }
      : await getContentRepository().addMediaAsset({
          titleId,
          blobKey: response.blobKey,
          fileName,
          contentType,
          assetType,
          ingestStatus: "ready",
          createdByUserId: auth.userId,
        });

    const lesson = optionB.projectionStoreBackend === "upstash"
      ? await getLessonFromProjection(titleId)
      : await getContentRepository().getLessonRecordById(titleId);
    const events: DomainEvent[] = [
      createDomainEvent({
        type: "media_asset_registered",
        aggregateType: "media_asset",
        aggregateId: asset.id,
        actor: {
          userId: auth.userId,
          role: effectiveRole,
        },
        idempotencyKey: buildEventIdempotencyKey("media-asset-register", asset.id, asset.assetType),
        payload: {
          assetId: asset.id,
          lessonId: titleId,
          courseId: lesson?.courseId,
          blobKey: asset.blobKey,
          fileName: asset.fileName,
          contentType: asset.contentType,
          assetType: asset.assetType,
          storageProvider: "shelby",
          createdByUserId: asset.createdByUserId,
          createdAt: asset.createdAt,
        },
      }),
    ];

    if (asset.assetType === "manifest" && lesson) {
      events.push(
        createDomainEvent({
          type: "lesson_manifest_attached",
          aggregateType: "lesson",
          aggregateId: lesson.id,
          actor: {
            userId: auth.userId,
            role: effectiveRole,
          },
          idempotencyKey: buildEventIdempotencyKey("lesson-manifest-attach", lesson.id, asset.id),
          payload: {
            lessonId: lesson.id,
            courseId: lesson.courseId,
            manifestBlobKey: asset.blobKey,
            streamAssetId: asset.id,
            updatedAt: new Date().toISOString(),
          },
        }),
      );
    } else if (asset.assetType === "source_video" && lesson) {
      events.push(
        createDomainEvent({
          type: "lesson_asset_attached",
          aggregateType: "lesson",
          aggregateId: lesson.id,
          actor: {
            userId: auth.userId,
            role: effectiveRole,
          },
          idempotencyKey: buildEventIdempotencyKey("lesson-source-attach", lesson.id, asset.id),
          payload: {
            lessonId: lesson.id,
            courseId: lesson.courseId,
            streamAssetId: asset.id,
            updatedAt: new Date().toISOString(),
          },
        }),
      );
    }

    await getEventStore().appendEvents(events);
    await runProjectionBatch(200);

    return jsonOk({ ...response, asset }, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return jsonError("UPSTREAM_ERROR", error.message, error.status);
    }
    const debugMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonError(
      "INTERNAL_ERROR",
      process.env.NODE_ENV === "production"
        ? "Unable to ingest into Verra storage"
        : `Unable to ingest into Verra storage: ${debugMessage}`,
      500,
    );
  }
}
