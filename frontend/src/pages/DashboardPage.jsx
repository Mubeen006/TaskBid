import { format } from "date-fns";
import { useDashboardStats } from "../features/dashboard/useDashboardStats";
import StatCard from "../features/dashboard/StatCard";
import ChartPanel from "../features/dashboard/ChartPanel";

const STATUS_COLORS = {
  draft:          "#a0aec0",
  open:           "#48bb78",
  bidding_closed: "#ecc94b",
  assigned:       "#63b3ed",
  in_progress:    "#9f7aea",
  review:         "#ed8936",
  done:           "#38a169",
};

const pageStyle = {
  maxWidth: "900px",
};

const headingStyle = {
  fontSize: "1.5rem",
  fontWeight: "600",
  color: "var(--text-h)",
  margin: "0 0 24px",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.88rem",
};

const thStyle = {
  textAlign: "left",
  padding: "4px 8px 4px 0",
  color: "var(--text)",
  fontWeight: "600",
  borderBottom: "1px solid var(--border)",
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "6px 8px 6px 0",
  color: "var(--text-h)",
  borderBottom: "1px solid var(--border)",
};

const rankStyle = {
  color: "var(--text)",
  fontVariantNumeric: "tabular-nums",
  width: "28px",
  display: "inline-block",
};

const skeletonStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const skeletonCardStyle = {
  height: "180px",
  borderRadius: "10px",
  background: "var(--border)",
  animation: "pulse 1.5s ease-in-out infinite",
};

const errorStyle = {
  padding: "12px 16px",
  borderRadius: "8px",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: "0.9rem",
};

const statusDotStyle = (status) => ({
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: STATUS_COLORS[status] || "#a0aec0",
  marginRight: "6px",
  verticalAlign: "middle",
});

function StatusRow({ status, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <tr>
      <td style={tdStyle}>
        <span style={statusDotStyle(status)} aria-hidden="true" />
        {status.replace("_", " ")}
      </td>
      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", textAlign: "right", width: "36px" }}>
        {count}
      </td>
      <td style={{ ...tdStyle, width: "80px", paddingLeft: "10px" }}>
        <div style={{ height: "6px", borderRadius: "3px", background: "var(--border)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: STATUS_COLORS[status] || "#a0aec0", borderRadius: "3px" }} />
        </div>
      </td>
    </tr>
  );
}

function SkeletonDashboard() {
  return (
    <>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      <div style={skeletonStyle}>
        {[1, 2, 3, 4].map(n => <div key={n} style={skeletonCardStyle} />)}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <h1 style={headingStyle}>Dashboard</h1>
        <SkeletonDashboard />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={pageStyle}>
        <h1 style={headingStyle}>Dashboard</h1>
        <div style={errorStyle} role="alert">
          <strong>Failed to load dashboard stats</strong>
          <p style={{ margin: "4px 0 0" }}>{error?.message || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const { tasksByStatus, avgBidByComplexity, topUsersByCompleted, zeroBidPastDeadline } = data;

  const totalTasks = tasksByStatus.reduce((sum, r) => sum + r.count, 0);

  const chartData = avgBidByComplexity.map(r => ({
    complexity: `C${r.complexity}`,
    averageHours: r.averageHours,
    rawComplexity: r.complexity,
  }));

  const barColors = chartData.map((_, i) => {
    const palette = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"];
    return palette[i % palette.length];
  });

  return (
    <div style={pageStyle}>
      <h1 style={headingStyle}>Dashboard</h1>
      <div style={gridStyle}>

        <StatCard title="Tasks by Status" isEmpty={tasksByStatus.length === 0} emptyMessage="No tasks yet.">
          <table style={tableStyle} aria-label="Tasks by status">
            <thead>
              <tr>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Count</th>
                <th style={{ ...thStyle, paddingLeft: "10px" }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {tasksByStatus.map(r => (
                <StatusRow key={r.status} status={r.status} count={r.count} total={totalTasks} />
              ))}
            </tbody>
          </table>
        </StatCard>

        <StatCard title="Avg Bid Hours by Complexity" isEmpty={avgBidByComplexity.length === 0} emptyMessage="No bids placed yet.">
          <ChartPanel
            data={chartData}
            xKey="complexity"
            yKey="averageHours"
            xLabel="Complexity"
            yLabel="Avg hours"
            yUnit="h"
            barColors={barColors}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--text)", margin: "6px 0 0", textAlign: "center" }}>
            C1–C5 = complexity levels 1–5
          </p>
        </StatCard>

        <StatCard title="Top Users by Completed Tasks" isEmpty={topUsersByCompleted.length === 0} emptyMessage="No completed tasks yet.">
          <table style={tableStyle} aria-label="Top users by completed tasks">
            <thead>
              <tr>
                <th style={thStyle}>Rank</th>
                <th style={thStyle}>User</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Done</th>
              </tr>
            </thead>
            <tbody>
              {topUsersByCompleted.map((u, i) => (
                <tr key={u.userId}>
                  <td style={tdStyle}><span style={rankStyle}>#{i + 1}</span></td>
                  <td style={tdStyle}>{u.name}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: "600" }}>
                    {u.completedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StatCard>

        <StatCard
          title="Zero-Bid Tasks Past Deadline"
          isEmpty={zeroBidPastDeadline.length === 0}
          emptyMessage="No tasks past deadline without bids."
        >
          <table style={tableStyle} aria-label="Zero-bid tasks past deadline">
            <thead>
              <tr>
                <th style={thStyle}>Task</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {zeroBidPastDeadline.map(t => (
                <tr key={t.taskId}>
                  <td style={tdStyle}>{t.title}</td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#dc2626", fontWeight: "600", fontVariantNumeric: "tabular-nums" }}>
                    {format(new Date(t.deadline), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StatCard>

      </div>
    </div>
  );
}
