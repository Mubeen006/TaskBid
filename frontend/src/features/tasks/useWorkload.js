import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";

export function useWorkload(userId) {
  return useQuery({
    queryKey: ["workload", userId],
    queryFn: () => apiFetch(`/api/users/${userId}/workload`),
    enabled: !!userId,
  });
}
