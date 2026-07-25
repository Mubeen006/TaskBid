import { useQuery } from "@tanstack/react-query";
import { getBids } from "../../api/bids.api";

export function useBids(taskId) {
  return useQuery({
    queryKey: ["bids", taskId],
    queryFn: () => getBids(taskId),
    enabled: !!taskId,
  });
}
