const STATUS_COLORS = {
  draft:          { bg: "#f4f3ec", color: "#6b6375" },
  open:           { bg: "#dcfce7", color: "#166534" },
  bidding_closed: { bg: "#fef9c3", color: "#854d0e" },
  assigned:       { bg: "#dbeafe", color: "#1e40af" },
  in_progress:    { bg: "#ede9fe", color: "#5b21b6" },
  review:         { bg: "#ffedd5", color: "#9a3412" },
  done:           { bg: "#f0fdf4", color: "#14532d" },
};

const STATUS_LABELS = {
  draft:          "Draft",
  open:           "Open",
  bidding_closed: "Bidding Closed",
  assigned:       "Assigned",
  in_progress:    "In Progress",
  review:         "Review",
  done:           "Done",
};

export default function StatusBadge({ status }) {
  const { bg, color } = STATUS_COLORS[status] || { bg: "#f4f3ec", color: "#6b6375" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: "600",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        background: bg,
        color,
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
