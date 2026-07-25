import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createBid } from "../../api/bids.api";

export function useCreateBid(taskId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hoursOffered, userId }) =>
      createBid(taskId, hoursOffered, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bids", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
