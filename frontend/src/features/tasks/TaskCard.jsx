import { useNavigate } from "react-router-dom";
import { format, isPast } from "date-fns";

const cardStyle = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "12px 14px",
  cursor: "pointer",
  transition: "box-shadow 0.15s",
  textAlign: "left",
};

const titleStyle = {
  fontSize: "0.95rem",
  fontWeight: "600",
  color: "var(--text-h)",
  margin: "0 0 8px",
  lineHeight: "1.3",
};

const metaStyle = {
  fontSize: "0.78rem",
  color: "var(--text)",
  display: "flex",
  flexWrap: "wrap",
  gap: "6px 12px",
  margin: "0",
};

const deadlineStyle = (overdue) => ({
  color: overdue ? "#dc2626" : "var(--text)",
  fontWeight: overdue ? "600" : "400",
});

function complexityDots(n) {
  return "●".repeat(n) + "○".repeat(5 - n);
}

function bidSummary(bidCount, lowestBidHours) {
  if (!bidCount || bidCount === 0) return "No bids yet";
  const lowest = lowestBidHours != null ? ` · lowest: ${lowestBidHours}h` : "";
  return `${bidCount} bid${bidCount !== 1 ? "s" : ""}${lowest}`;
}

export default function TaskCard({ task }) {
  const navigate = useNavigate();
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const overdue = deadline ? isPast(deadline) : false;
  const deadlineText = deadline ? format(deadline, "MMM d, yyyy") : "—";

  return (
    <div
      role="button"
      tabIndex={0}
      style={cardStyle}
      onClick={() => navigate(`/tasks/${task._id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/tasks/${task._id}`); }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
      aria-label={`Task: ${task.title}`}
    >
      <p style={titleStyle}>{task.title}</p>
      <p style={metaStyle}>
        <span title={`Complexity ${task.complexity}/5`}>
          {complexityDots(task.complexity)}
        </span>
        <span style={deadlineStyle(overdue)}>
          {overdue ? "⚠ " : ""}{deadlineText}
        </span>
        <span>{bidSummary(task.bidCount, task.lowestBidHours)}</span>
      </p>
    </div>
  );
}
