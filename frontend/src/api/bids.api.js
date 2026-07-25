import { apiFetch } from "./client";

export function getBids(taskId) {
  return apiFetch(`/api/tasks/${taskId}/bids`);
}

export function createBid(taskId, hoursOffered, userId) {
  return apiFetch(
    `/api/tasks/${taskId}/bids`,
    { method: "POST", body: JSON.stringify({ hoursOffered }) },
    userId
  );
}

export function assignTask(taskId, userId) {
  return apiFetch(
    `/api/tasks/${taskId}/assign`,
    { method: "POST" },
    userId
  );
}

export function advanceStatus(taskId, targetStatus, userId) {
  return apiFetch(
    `/api/tasks/${taskId}/status`,
    { method: "PATCH", body: JSON.stringify({ targetStatus }) },
    userId
  );
}
