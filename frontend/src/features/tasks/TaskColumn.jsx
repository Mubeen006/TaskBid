import StatusBadge from "./StatusBadge";
import TaskCard from "./TaskCard";

const columnStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  minWidth: "220px",
  flex: "0 0 220px",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "4px",
};

const countStyle = {
  fontSize: "0.78rem",
  color: "var(--text)",
  fontWeight: "600",
  background: "var(--code-bg)",
  borderRadius: "999px",
  padding: "1px 8px",
};

const emptyStyle = {
  fontSize: "0.8rem",
  color: "var(--text)",
  fontStyle: "italic",
  padding: "10px 4px",
};

export default function TaskColumn({ status, tasks }) {
  return (
    <div style={columnStyle}>
      <div style={headerStyle}>
        <StatusBadge status={status} />
        <span style={countStyle}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p style={emptyStyle}>No tasks in this status</p>
      ) : (
        tasks.map((task) => <TaskCard key={task._id} task={task} />)
      )}
    </div>
  );
}
