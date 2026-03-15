import type {
  ShelbyBlobWriteRequest,
  ShelbyBlobWriteResponse,
} from "@/lib/contracts/shelby-storage";
import { ServiceError } from "@/lib/services/http-client";

function getShelbyRpcConfig() {
  const rpcUrl = process.env.SHELBY_RPC_URL;
  const readPath = process.env.SHELBY_RPC_READ_PATH || "/v1/blobs";
  const writePath = process.env.SHELBY_RPC_WRITE_PATH || "/v1/blobs";
  const apiKey = process.env.SHELBY_RPC_API_KEY || process.env.SHELBY_API_KEY;
  const authHeader = (
    process.env.SHELBY_RPC_AUTH_HEADER ||
    process.env.SHELBY_API_AUTH_HEADER ||
    "x-api-key"
  ).toLowerCase();
  return { rpcUrl, readPath, writePath, apiKey, authHeader };
}

function joinBlobReadUrl(
  baseUrl: string,
  path: string,
  accountAddress: string,
  blobName: string,
) {
  const parsed = new URL(baseUrl);
  const basePath = parsed.pathname.replace(/\/+$/, "");
  const requestedPath = `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const normalizedPath =
    basePath && requestedPath.startsWith(`${basePath}/`)
      ? requestedPath
      : `${basePath}${requestedPath}`.replace(/\/{2,}/g, "/");
  const encodedBlobName = blobName
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  parsed.pathname = `${normalizedPath}/${encodeURIComponent(accountAddress)}/${encodedBlobName}`;
  return parsed.toString();
}

function joinPath(baseUrl: string, path: string) {
  const parsed = new URL(baseUrl);
  const basePath = parsed.pathname.replace(/\/+$/, "");
  const requestedPath = `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const normalizedPath =
    basePath && requestedPath.startsWith(`${basePath}/`)
      ? requestedPath
      : `${basePath}${requestedPath}`.replace(/\/{2,}/g, "/");
  parsed.pathname = normalizedPath;
  return parsed.toString();
}

export function getTitleManifestBlobKey(titleId: string) {
  return `titles/${titleId}/master.m3u8`;
}

export function buildStoredBlobKey(accountAddress: string, blobName: string) {
  return `${accountAddress}/${blobName}`;
}

export function parseStoredBlobKey(storedBlobKey: string) {
  const segments = storedBlobKey.split("/").filter(Boolean);
  const [accountAddress, ...blobSegments] = segments;
  if (!accountAddress || blobSegments.length === 0) return null;
  return {
    accountAddress,
    blobName: blobSegments.join("/"),
  };
}

export function getShelbyAuthHeaderName() {
  return getShelbyRpcConfig().authHeader;
}

export function getShelbyApiKey() {
  return getShelbyRpcConfig().apiKey;
}

export function getShelbyBlobReadUrl(accountAddress: string, blobName: string) {
  const { rpcUrl, readPath, apiKey } = getShelbyRpcConfig();
  if (!rpcUrl) {
    throw new ServiceError("shelby-storage", 503, "SHELBY_RPC_URL is not configured");
  }
  if (!apiKey) {
    throw new ServiceError("shelby-storage", 503, "SHELBY_API_KEY or SHELBY_RPC_API_KEY is not configured");
  }
  return joinBlobReadUrl(rpcUrl, readPath, accountAddress, blobName);
}

export function getInternalBlobReadPath(blobKey: string) {
  const segments = blobKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
  return `/api/v1/storage/read/${segments.join("/")}`;
}

export async function putShelbyBlob(
  payload: ShelbyBlobWriteRequest,
): Promise<ShelbyBlobWriteResponse> {
  const { rpcUrl, apiKey } = getShelbyRpcConfig();
  if (!rpcUrl) {
    throw new ServiceError("shelby-storage", 503, "SHELBY_RPC_URL is not configured");
  }
  if (!apiKey) {
    throw new ServiceError("shelby-storage", 503, "SHELBY_API_KEY or SHELBY_RPC_API_KEY is not configured");
  }

  const authHeader = { Authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}` };

  const partSize = 5 * 1024 * 1024;
  let startResponse: Response;
  try {
    startResponse = await fetch(joinPath(rpcUrl, "/v1/multipart-uploads"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({
        rawAccount: payload.accountAddress,
        rawBlobName: payload.blobName,
        rawPartSize: partSize,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shelby RPC is unreachable";
    throw new ServiceError("shelby-storage", 502, `Shelby multipart start network error: ${message}`);
  }

  if (!startResponse.ok) {
    const responseText = await startResponse.text().catch(() => "");
    throw new ServiceError(
      "shelby-storage",
      startResponse.status,
      `Shelby blob write failed with ${startResponse.status}${responseText ? `: ${responseText.slice(0, 300)}` : ""}`,
    );
  }

  const startBody = (await startResponse.json().catch(() => null)) as { uploadId?: string } | null;
  const uploadId = startBody?.uploadId;
  if (!uploadId) {
    throw new ServiceError("shelby-storage", 502, "Shelby multipart start missing uploadId");
  }

  const totalParts = Math.ceil(payload.data.length / partSize);
  for (let partIdx = 0; partIdx < totalParts; partIdx += 1) {
    const start = partIdx * partSize;
    const end = Math.min(start + partSize, payload.data.length);
    const partData = payload.data.slice(start, end);
    const partResponse = await fetch(
      joinPath(rpcUrl, `/v1/multipart-uploads/${encodeURIComponent(uploadId)}/parts/${partIdx}`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          ...authHeader,
        },
        body: Buffer.from(partData),
      },
    );
    if (!partResponse.ok) {
      const responseText = await partResponse.text().catch(() => "");
      throw new ServiceError(
        "shelby-storage",
        partResponse.status,
        `Shelby upload part failed with ${partResponse.status}${responseText ? `: ${responseText.slice(0, 300)}` : ""}`,
      );
    }
  }

  const completeResponse = await fetch(
    joinPath(rpcUrl, `/v1/multipart-uploads/${encodeURIComponent(uploadId)}/complete`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
    },
  );
  if (!completeResponse.ok) {
    const responseText = await completeResponse.text().catch(() => "");
    throw new ServiceError(
      "shelby-storage",
      completeResponse.status,
      `Shelby complete upload failed with ${completeResponse.status}${responseText ? `: ${responseText.slice(0, 300)}` : ""}`,
    );
  }

  const blobKey = buildStoredBlobKey(payload.accountAddress, payload.blobName);
  return {
    blobKey,
    readUrl: getShelbyBlobReadUrl(payload.accountAddress, payload.blobName),
    sizeBytes: payload.data.byteLength,
  };
}
