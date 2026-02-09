import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#4C6FFF', '#FFB020', '#F04D4D', '#2EB67D', '#9B59B6'];

const formatValue = (entry) => {
  if (typeof entry.totalUnits === 'number') {
    return entry.totalUnits;
  }
  if (typeof entry.count === 'number') {
    return entry.count;
  }
  return 0;
};

export default function AllocationChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="empty">No allocation data available.</div>;
  }

  const chartData = data.map((entry, index) => ({
    name: entry._id || `status-${index + 1}`,
    value: formatValue(entry),
    count: entry.count
  }));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90}>
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${value}`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="legend">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="legend-item">
            <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }} />
            <span>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
