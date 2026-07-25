const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  borderRadius: "6px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  fontSize: "0.88rem",
};

const hoursStyle = {
  fontWeight: "600",
  color: "var(--text-h)",
  fontVariantNumeric: "tabular-nums",
};

const nameStyle = {
  color: "var(--text)",
};

const statusColors = {
  pending:      { color: "#854d0e", bg: "#fef9c3" },
  assigned:     { color: "#1e40af", bg: "#dbeafe" },
  not_selected: { color: "#6b6375", bg: "#f4f3ec" },
};

const statusLabels = {
  pending:      "Pending",
  assigned:     "Assigned",
  not_selected: "Not selected",
};

function StatusChip({ status }) {
  const { color, bg } = statusColors[status] || statusColors.pending;
  return (
    <span style={{
      fontSize: "0.72rem", fontWeight: "600", padding: "2px 8px",
      borderRadius: "999px", background: bg, color,
    }}>
      {statusLabels[status] || status}
    </span>
  );
}

export default function BidRow({ bid, isCurrentUser }) {
  return (
    <div style={{ ...rowStyle, ...(isCurrentUser ? { borderColor: "var(--accent-border)", background: "var(--accent-bg)" } : {}) }}>
      <span style={nameStyle}>
        {isCurrentUser ? <strong>You</strong> : (bid.userName || bid.user)}
      </span>
      <span style={hoursStyle}>{bid.hoursOffered}h</span>
      <StatusChip status={bid.status} />
    </div>
  );
}
