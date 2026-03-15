type HttpMethod = "GET" | "POST";

export class ServiceError extends Error {
  status: number;
  service: string;

  constructor(service: string, status: number, message: string) {
    super(message);
    this.service = service;
    this.status = status;
  }
}

type RequestOptions = {
  service: string;
  method?: HttpMethod;
  path: string;
  baseUrl?: string;
  token?: string;
  body?: unknown;
  timeoutMs?: number;
};

function makeUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export async function requestJson<T>(opts: RequestOptions): Promise<T> {
  if (!opts.baseUrl) {
    throw new ServiceError(opts.service, 503, `Missing ${opts.service} base URL`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4000);

  try {
    const response = await fetch(makeUrl(opts.baseUrl, opts.path), {
      method: opts.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = `Service ${opts.service} returned ${response.status}`;
      throw new ServiceError(opts.service, response.status, message);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(opts.service, 504, `Service ${opts.service} timed out`);
    }
    throw new ServiceError(opts.service, 502, `Service ${opts.service} unavailable`);
  } finally {
    clearTimeout(timeout);
  }
}
