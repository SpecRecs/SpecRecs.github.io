import type { UserRequest } from "../../types/request.ts";

// Saved after every answer, so a reload resumes where the user left off.
const STORAGE_KEY = "specrecs.request.v1";

export function loadRequest(): UserRequest {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (raw && typeof raw === "object") return raw as UserRequest;
  } catch {}
  return {};
}

export function saveRequest(request: UserRequest) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(request)); } catch {}
}

export function clearRequest() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
