import { getBearerAuthHeaders } from "@/lib/client/access-token";

export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(getBearerAuthHeaders())) {
    if (!headers.has(key)) headers.set(key, value);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
