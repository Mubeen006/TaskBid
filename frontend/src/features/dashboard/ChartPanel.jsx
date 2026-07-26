import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const DEFAULT_COLOR = "#6366f1";

const containerStyle = {
  width: "100%",
  height: 240,
};

const labelStyle = {
  fontSize: "0.75rem",
  color: "var(--text)",
};

function CustomTooltip({ active, payload, label, xLabel, yLabel, yUnit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
      padding: "8px 12px",
      fontSize: "0.82rem",
      color: "var(--text-h)",
    }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{xLabel}: {label}</p>
      <p style={{ margin: "2px 0 0" }}>{yLabel}: {payload[0].value}{yUnit || ""}</p>
    </div>
  );
}

export default function ChartPanel({
  data,
  xKey,
  yKey,
  xLabel = "X",
  yLabel = "Y",
  yUnit = "",
  barColor = DEFAULT_COLOR,
  barColors,
}) {
  return (
    <div style={containerStyle}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey={xKey}
            tick={{ ...labelStyle, fill: "var(--text)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ ...labelStyle, fill: "var(--text)" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            content={<CustomTooltip xLabel={xLabel} yLabel={yLabel} yUnit={yUnit} />}
            cursor={{ fill: "var(--code-bg)" }}
          />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={barColors ? barColors[index % barColors.length] : barColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
