import { apiFetch } from "./client";

export function getDashboardStats() {
  return apiFetch("/api/dashboard/stats");
}
