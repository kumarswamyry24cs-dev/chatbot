import React, { useState, useEffect } from 'react';

function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, statusFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/api/dashboard/logs?page=${pagination.page}&limit=25`;
      if (statusFilter) url += `&status=${statusFilter}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="logs-page">
      <h1>Inference Logs</h1>

      <div className="logs-filters">
        <select 
          value={statusFilter} 
          onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({...p, page: 1})); }}
        >
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="timeout">Timeout</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>
          {pagination.total} total logs
        </span>
      </div>

      {loading ? (
        <div className="loading">Loading logs...</div>
      ) : (
        <>
          <table className="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Model</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Input Preview</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{formatTimestamp(log.timestamp)}</td>
                  <td>{log.model}</td>
                  <td>{log.provider}</td>
                  <td>
                    <span className={`status-pill ${log.status}`}>
                      {log.status}
                    </span>
                  </td>
                  <td>{log.latency_ms}ms</td>
                  <td>{log.total_tokens}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.input_preview || '-'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                    No logs found. Start chatting to generate inference logs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setPagination(p => ({...p, page: p.page - 1}))}
                disabled={pagination.page <= 1}
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button 
                onClick={() => setPagination(p => ({...p, page: p.page + 1}))}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LogsPage;
