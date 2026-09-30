import { fetchWithTabSession } from "./tabSession";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function apiFetch(path: string, init?: RequestInit, retry = true) {
  const response = await fetchWithTabSession(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });
  if (response.status === 401 && retry) {
    const refresh = await fetchWithTabSession(`${API_URL}/auth/refresh`, { method: "POST" });
    if (refresh.ok) return apiFetch(path, init, false);
  }
  return response;
}

export async function responseMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
}
