import { useMutation, useQueryClient } from "@tanstack/react-query";
import { advanceStatus } from "../../api/bids.api";

export function useAdvanceStatus(taskId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetStatus, userId }) =>
      advanceStatus(taskId, targetStatus, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
