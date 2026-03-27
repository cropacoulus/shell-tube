export const ACCESS_TOKEN_STORAGE_KEY = "verra_access_token";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAccessToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function getBearerAuthHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) return {};
  return {
    authorization: `Bearer ${token}`,
  };
}
