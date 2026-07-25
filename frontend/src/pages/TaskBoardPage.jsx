import { useTasks } from "../features/tasks/useTasks";
import TaskColumn from "../features/tasks/TaskColumn";

const STATUS_ORDER = [
  "draft",
  "open",
  "bidding_closed",
  "assigned",
  "in_progress",
  "review",
  "done",
];

const boardStyle = {
  display: "flex",
  gap: "16px",
  overflowX: "auto",
  paddingBottom: "16px",
  alignItems: "flex-start",
};

const skeletonStyle = {
  display: "flex",
  gap: "16px",
  paddingBottom: "16px",
};

const skeletonColStyle = {
  minWidth: "220px",
  flex: "0 0 220px",
};

const skeletonCardStyle = {
  height: "72px",
  borderRadius: "8px",
  background: "var(--border)",
  marginBottom: "8px",
  animation: "pulse 1.5s ease-in-out infinite",
};

const errorBoxStyle = {
  padding: "16px",
  borderRadius: "8px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: "0.9rem",
};

function SkeletonBoard() {
  return (
    <div style={skeletonStyle}>
      {STATUS_ORDER.map((s) => (
        <div key={s} style={skeletonColStyle}>
          <div style={{ height: "24px", borderRadius: "999px", background: "var(--border)", marginBottom: "12px", width: "100px" }} />
          {[1, 2].map((n) => <div key={n} style={skeletonCardStyle} />)}
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

export default function TaskBoardPage() {
  const { data: tasks, isLoading, isError, error } = useTasks();

  if (isLoading) {
    return (
      <>
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 20px" }}>Task Board</h1>
        <SkeletonBoard />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <h1 style={{ fontSize: "1.5rem", margin: "0 0 20px" }}>Task Board</h1>
        <div style={errorBoxStyle} role="alert">
          <strong>Failed to load tasks</strong>
          <p style={{ margin: "4px 0 0" }}>{error?.message || "Unknown error"}</p>
        </div>
      </>
    );
  }

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = [];
    return acc;
  }, {});

  (tasks || []).forEach((task) => {
    if (grouped[task.status]) {
      grouped[task.status].push(task);
    }
  });

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 20px" }}>Task Board</h1>
      <div style={boardStyle}>
        {STATUS_ORDER.map((status) => (
          <TaskColumn key={status} status={status} tasks={grouped[status]} />
        ))}
      </div>
    </>
  );
}
