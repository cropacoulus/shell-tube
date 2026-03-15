import {
  getShelbyApiKey,
  getShelbyAuthHeaderName,
  getShelbyBlobReadUrl,
  parseStoredBlobKey,
} from "@/lib/services/shelby-storage-client";

function buildBlobKey(params: { blobKey?: string[] }) {
  const segments = params.blobKey ?? [];
  if (segments.length === 0) return "";
  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

async function proxyBlob(req: Request, params: { blobKey?: string[] }) {
  const blobKey = buildBlobKey(params);
  if (!blobKey) {
    return Response.json(
      { ok: false, error: { code: "INVALID_REQUEST", message: "blobKey is required" } },
      { status: 422 },
    );
  }

  const parsed = parseStoredBlobKey(blobKey);
  if (!parsed) {
    return Response.json(
      { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid stored blob key format" } },
      { status: 422 },
    );
  }
  const url = getShelbyBlobReadUrl(parsed.accountAddress, parsed.blobName);
  const apiKey = getShelbyApiKey();
  const authHeader = getShelbyAuthHeaderName();

  const upstreamHeaders = new Headers();
  const range = req.headers.get("range");
  if (range) upstreamHeaders.set("range", range);
  if (apiKey) {
    if (authHeader === "authorization") {
      upstreamHeaders.set("authorization", apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`);
    } else {
      upstreamHeaders.set(authHeader, apiKey);
    }
  }

  const upstream = await fetch(url, {
    method: req.method,
    headers: upstreamHeaders,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "etag",
    "last-modified",
    "cache-control",
  ];
  for (const header of passthroughHeaders) {
    const value = upstream.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  return new Response(req.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ blobKey?: string[] }> },
) {
  const params = await context.params;
  return proxyBlob(req, params);
}

export async function HEAD(
  req: Request,
  context: { params: Promise<{ blobKey?: string[] }> },
) {
  const params = await context.params;
  return proxyBlob(req, params);
}
