import { apiFetch } from "./client";

export function getTasks(status) {
  const path = status ? `/api/tasks?status=${encodeURIComponent(status)}` : "/api/tasks";
  return apiFetch(path);
}
