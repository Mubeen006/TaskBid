export class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details || [];
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function apiFetch(path, options = {}, userId = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(userId ? { "X-User-Id": userId } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError("NETWORK_ERROR", `HTTP ${response.status}`);
    }
    const err = payload?.error || {};
    throw new ApiError(
      err.code || "UNKNOWN_ERROR",
      err.message || `HTTP ${response.status}`,
      err.details
    );
  }

  if (response.status === 204) return null;
  return response.json();
}
