import { useQuery } from "@tanstack/react-query";
import { getTasks } from "../../api/tasks.api";

export function useTask(id) {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => getTasks(),
    select: (tasks) => tasks.find((t) => t._id === id) ?? null,
  });
}
