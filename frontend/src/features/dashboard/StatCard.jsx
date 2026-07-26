const cardStyle = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "18px 20px",
};

const titleStyle = {
  fontSize: "0.8rem",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text)",
  margin: "0 0 12px",
};

const emptyStyle = {
  fontSize: "0.85rem",
  color: "var(--text)",
  fontStyle: "italic",
};

export default function StatCard({ title, children, isEmpty, emptyMessage }) {
  return (
    <div style={cardStyle}>
      <p style={titleStyle}>{title}</p>
      {isEmpty ? (
        <p style={emptyStyle}>{emptyMessage || "No data available."}</p>
      ) : (
        children
      )}
    </div>
  );
}
