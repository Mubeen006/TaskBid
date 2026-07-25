import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignTask } from "../../api/bids.api";

export function useAssignTask(taskId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => assignTask(taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["bids", taskId] });
    },
  });
}
