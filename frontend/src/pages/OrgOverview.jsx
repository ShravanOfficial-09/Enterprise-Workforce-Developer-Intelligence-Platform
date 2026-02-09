import { useCallback, useMemo, useState } from 'react';
import AllocationChart from '../components/AllocationChart.jsx';
import KeyValueList from '../components/KeyValueList.jsx';
import StatCard from '../components/StatCard.jsx';
import { fetchOrgOverview } from '../api/analytics.js';

const getInitialOrgId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('organizationId') || import.meta.env.VITE_ORG_ID || '';
};

export default function OrgOverview() {
  const [organizationId, setOrganizationId] = useState(getInitialOrgId);
  const [metricKey, setMetricKey] = useState('pr_turnaround_avg_hours');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const loadOverview = useCallback(async () => {
    if (!organizationId) {
      setError('organizationId is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetchOrgOverview({
        organizationId,
        metricKey,
        windowValue: 30,
        windowUnit: 'day'
      });
      setData(response);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load org overview.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, metricKey]);

  const allocationData = useMemo(() => data?.workforceAllocation?.distributionByStatus || [], [data]);
  const complianceData = useMemo(() => data?.complianceRisks?.activeBySeverity || [], [data]);
  const burnoutCount = data?.burnoutRisk?.activeSignals ?? 0;
  const productivitySignals = useMemo(() => data?.productivity?.activeSignalsByKey || [], [data]);
  const productivityMetric = data?.productivity?.metricSummary || null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Org Overview</h1>
          <p>Read-only analytics across allocation, compliance, productivity, and risk indicators.</p>
        </div>
        <div className="controls">
          <input
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            placeholder="Organization ID"
          />
          <input
            value={metricKey}
            onChange={(event) => setMetricKey(event.target.value)}
            placeholder="Metric Key"
          />
          <button onClick={loadOverview} disabled={loading}>Load</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Loading...</div>}

      {!loading && data && (
        <div className="grid">
          <section className="card">
            <h2>Workforce Allocation</h2>
            <AllocationChart data={allocationData} />
          </section>

          <section className="card">
            <h2>Compliance Risks</h2>
            <KeyValueList
              items={complianceData.map((item) => ({
                label: item._id || 'unknown',
                value: item.count
              }))}
              emptyLabel="No active compliance risks."
            />
          </section>

          <section className="card">
            <h2>Burnout Risk Indicators</h2>
            <StatCard label="Active Signals" value={burnoutCount} />
          </section>

          <section className="card">
            <h2>Productivity Trends</h2>
            <KeyValueList
              items={productivitySignals.map((item) => ({
                label: item._id || 'unknown',
                value: item.count
              }))}
              emptyLabel="No active productivity signals."
            />
            {productivityMetric && (
              <div className="metric-summary">
                <div>Metric: {productivityMetric.metricKey}</div>
                <div>Average: {productivityMetric.averageValue ?? 'n/a'}</div>
                <div>Computed: {productivityMetric.latestComputedAt ? new Date(productivityMetric.latestComputedAt).toLocaleString() : 'n/a'}</div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
