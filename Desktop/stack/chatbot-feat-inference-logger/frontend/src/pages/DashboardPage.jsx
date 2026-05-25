import React, { useState, useEffect } from 'react';

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [latencyData, setLatencyData] = useState([]);
  const [throughputData, setThroughputData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, latencyRes, throughputRes, errorsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/latency?hours=24'),
        fetch('/api/dashboard/throughput?minutes=60'),
        fetch('/api/dashboard/errors?limit=10')
      ]);

      setStats(await statsRes.json());
      setLatencyData(await latencyRes.json());
      setThroughputData(await throughputRes.json());
      setErrors(await errorsRes.json());
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const maxLatency = Math.max(...latencyData.map(d => d.avg_latency), 1);
  const maxThroughput = Math.max(...throughputData.map(d => d.requests), 1);

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Requests</div>
          <div className="value primary">{stats?.requests?.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Successful</div>
          <div className="value success">{stats?.requests?.success || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Errors</div>
          <div className="value error">{stats?.requests?.errors || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Error Rate</div>
          <div className="value warning">{stats?.requests?.errorRate || 0}%</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg Latency</div>
          <div className="value primary">{stats?.latency?.avg || 0}ms</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Tokens</div>
          <div className="value">{(stats?.tokens?.total || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Conversations</div>
          <div className="value primary">{stats?.conversations || 0}</div>
        </div>
        <div className="stat-card">
          <div className="label">Min / Max Latency</div>
          <div className="value" style={{ fontSize: '1.2rem' }}>
            {stats?.latency?.min || 0}ms / {stats?.latency?.max || 0}ms
          </div>
        </div>
      </div>

      {/* Latency Chart */}
      <div className="dashboard-section">
        <h2>Latency Over Time (Last 24h)</h2>
        <div className="chart-container">
          {latencyData.length > 0 ? (
            <div className="bar-chart">
              {latencyData.map((d, i) => (
                <div
                  key={i}
                  className="bar"
                  style={{ height: `${(d.avg_latency / maxLatency) * 100}%` }}
                  title={`${d.hour}: ${Math.round(d.avg_latency)}ms avg (${d.request_count} requests)`}
                />
              ))}
            </div>
          ) : (
            <div className="loading">No latency data yet. Start chatting to generate data.</div>
          )}
        </div>
      </div>

      {/* Throughput Chart */}
      <div className="dashboard-section">
        <h2>Throughput (Last Hour)</h2>
        <div className="chart-container">
          {throughputData.length > 0 ? (
            <div className="bar-chart">
              {throughputData.map((d, i) => (
                <div
                  key={i}
                  className="bar"
                  style={{ height: `${(d.requests / maxThroughput) * 100}%` }}
                  title={`${d.minute}: ${d.requests} requests (${d.success} ok, ${d.errors} err)`}
                />
              ))}
            </div>
          ) : (
            <div className="loading">No throughput data yet.</div>
          )}
        </div>
      </div>

      {/* Recent Errors */}
      <div className="dashboard-section">
        <h2>Recent Errors</h2>
        {errors.length > 0 ? (
          <div className="error-list">
            {errors.map(err => (
              <div key={err.id} className="error-item">
                <div className="error-header">
                  <span className="error-message">{err.error_message || 'Unknown error'}</span>
                  <span className="error-time">{new Date(err.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Model: {err.model} | Latency: {err.latency_ms}ms | Status: {err.status}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="chart-container">
            <div className="loading">No errors recorded. That's great!</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
