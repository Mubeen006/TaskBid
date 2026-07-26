import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import socket from "./socket";

export function useRealtimeBids(taskId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!taskId) return;

    socket.emit("join:task", { taskId });

    function onBidCreated(bid) {
      queryClient.setQueryData(["bids", taskId], (prev) => {
        if (!prev) return [bid];
        const exists = prev.some((b) => b._id === bid._id);
        if (exists) return prev;
        const updated = [...prev, bid];
        updated.sort((a, b) => a.hoursOffered - b.hoursOffered);
        return updated;
      });
    }

    function onTaskAssigned() {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["bids", taskId] });
    }

    function onReconnect() {
      socket.emit("join:task", { taskId });
      queryClient.invalidateQueries({ queryKey: ["bids", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }

    socket.on("bid:created", onBidCreated);
    socket.on("task:assigned", onTaskAssigned);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.emit("leave:task", { taskId });
      socket.off("bid:created", onBidCreated);
      socket.off("task:assigned", onTaskAssigned);
      socket.io.off("reconnect", onReconnect);
    };
  }, [taskId, queryClient]);
}
