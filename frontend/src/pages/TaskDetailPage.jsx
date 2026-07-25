import { useParams, useNavigate } from "react-router-dom";
import { format, isPast } from "date-fns";
import { useState } from "react";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useTask } from "../features/tasks/useTask";
import { useBids } from "../features/bids/useBids";
import { useAssignTask } from "../features/bids/useAssignTask";
import { useAdvanceStatus } from "../features/bids/useAdvanceStatus";
import StatusBadge from "../features/tasks/StatusBadge";
import BidList from "../features/bids/BidList";
import BidForm from "../features/bids/BidForm";

const STATUS_SEQUENCE = ["draft","open","bidding_closed","assigned","in_progress","review","done"];

const pageStyle = { maxWidth: "720px" };

const sectionStyle = {
  marginBottom: "28px",
};

const headingStyle = {
  fontSize: "1.5rem",
  fontWeight: "600",
  color: "var(--text-h)",
  margin: "0 0 8px",
  lineHeight: "1.3",
};

const metaRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 20px",
  fontSize: "0.85rem",
  color: "var(--text)",
  margin: "8px 0 12px",
  alignItems: "center",
};

const descStyle = {
  fontSize: "0.92rem",
  color: "var(--text)",
  lineHeight: "1.6",
  margin: "0",
};

const subHeadingStyle = {
  fontSize: "1rem",
  fontWeight: "600",
  color: "var(--text-h)",
  margin: "0 0 10px",
};

const btnStyle = (variant, disabled) => ({
  padding: "6px 16px",
  borderRadius: "6px",
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: "600",
  fontSize: "0.88rem",
  ...(variant === "primary"
    ? { background: disabled ? "var(--border)" : "var(--accent)", color: disabled ? "var(--text)" : "#fff" }
    : { background: "var(--code-bg)", color: "var(--text-h)", border: "1px solid var(--border)" }),
});

const alertStyle = (type) => ({
  padding: "8px 12px",
  borderRadius: "6px",
  fontSize: "0.85rem",
  marginTop: "8px",
  ...(type === "error"
    ? { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }
    : { background: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534" }),
});

const skeletonLine = (w, h = "16px") => ({
  height: h, width: w, background: "var(--border)",
  borderRadius: "4px", display: "block",
});

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <span style={skeletonLine("60%", "28px")} />
      <span style={skeletonLine("40%")} />
      <span style={skeletonLine("90%")} />
      <span style={skeletonLine("80%")} />
    </div>
  );
}

function complexityDots(n) {
  return "●".repeat(n) + "○".repeat(5 - n);
}

function nextStatus(current) {
  const idx = STATUS_SEQUENCE.indexOf(current);
  return idx >= 0 && idx < STATUS_SEQUENCE.length - 1 ? STATUS_SEQUENCE[idx + 1] : null;
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();

  const { data: task, isLoading: taskLoading, isError: taskError } = useTask(id);
  const { data: bids, isLoading: bidsLoading } = useBids(id);
  const assignTask = useAssignTask(id);
  const advanceStatus = useAdvanceStatus(id);

  const [assignFeedback, setAssignFeedback] = useState(null);
  const [statusFeedback, setStatusFeedback] = useState(null);

  if (taskLoading) {
    return (
      <div style={pageStyle}>
        <button onClick={() => navigate("/board")} style={{ ...btnStyle("secondary", false), marginBottom: "16px" }}>
          ← Back to Board
        </button>
        <Skeleton />
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div style={pageStyle}>
        <button onClick={() => navigate("/board")} style={{ ...btnStyle("secondary", false), marginBottom: "16px" }}>
          ← Back to Board
        </button>
        <p style={alertStyle("error")}>Task not found or failed to load.</p>
      </div>
    );
  }

  const deadline = task.deadline ? new Date(task.deadline) : null;
  const overdue = deadline ? isPast(deadline) : false;
  const deadlineText = deadline ? format(deadline, "MMM d, yyyy") : "—";
  const next = nextStatus(task.status);

  async function handleAssign() {
    setAssignFeedback(null);
    try {
      const result = await assignTask.mutateAsync(currentUser._id);
      const winnerName = result?.assignedUserId || "a bidder";
      setAssignFeedback({ type: "success", message: `Assigned to user ${winnerName}.` });
    } catch (err) {
      setAssignFeedback({ type: "error", message: err.message || "Assignment failed." });
    }
  }

  async function handleAdvanceStatus() {
    if (!next) return;
    setStatusFeedback(null);
    try {
      await advanceStatus.mutateAsync({ targetStatus: next, userId: currentUser._id });
      setStatusFeedback({ type: "success", message: `Status advanced to "${next}".` });
    } catch (err) {
      setStatusFeedback({ type: "error", message: err.message || "Status change failed." });
    }
  }

  return (
    <div style={pageStyle}>
      <button
        onClick={() => navigate("/board")}
        style={{ ...btnStyle("secondary", false), marginBottom: "16px" }}
      >
        ← Back to Board
      </button>

      <div style={sectionStyle}>
        <h1 style={headingStyle}>{task.title}</h1>
        <div style={metaRowStyle}>
          <StatusBadge status={task.status} />
          <span title={`Complexity ${task.complexity}/5`}>{complexityDots(task.complexity)}</span>
          <span style={{ color: overdue ? "#dc2626" : "var(--text)", fontWeight: overdue ? "600" : "400" }}>
            {overdue ? "⚠ Overdue · " : "Deadline: "}{deadlineText}
          </span>
        </div>
        {task.description && <p style={descStyle}>{task.description}</p>}
      </div>

      {(task.status === "bidding_closed" || next) && currentUser && (
        <div style={{ ...sectionStyle, display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {task.status === "bidding_closed" && (
            <div>
              <button
                style={btnStyle("primary", assignTask.isPending)}
                disabled={assignTask.isPending}
                onClick={handleAssign}
              >
                {assignTask.isPending ? "Assigning…" : "Assign Task"}
              </button>
              {assignFeedback && (
                <p style={alertStyle(assignFeedback.type)}>{assignFeedback.message}</p>
              )}
            </div>
          )}
          {next && next !== "assigned" && (
            <div>
              <button
                style={btnStyle("secondary", advanceStatus.isPending)}
                disabled={advanceStatus.isPending}
                onClick={handleAdvanceStatus}
              >
                {advanceStatus.isPending ? "Updating…" : `Advance to "${next}"`}
              </button>
              {statusFeedback && (
                <p style={alertStyle(statusFeedback.type)}>{statusFeedback.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={sectionStyle}>
        <h2 style={subHeadingStyle}>
          Bids {bids ? `(${bids.length})` : ""}
        </h2>
        {bidsLoading
          ? <p style={{ fontSize: "0.85rem", color: "var(--text)" }}>Loading bids…</p>
          : <BidList bids={bids} currentUserId={currentUser?._id} />
        }
      </div>

      {task.status === "open" && (
        <div style={sectionStyle}>
          <h2 style={subHeadingStyle}>Place a Bid</h2>
          <BidForm task={task} currentUser={currentUser} bids={bids || []} />
        </div>
      )}
    </div>
  );
}
