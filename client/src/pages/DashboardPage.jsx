import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  Activity,
  Mic,
  CheckSquare,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import ApiClient from '../services/api';
import StatCard from '../components/common/StatCard';
import Badge from '../components/common/Badge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import HygieneScoreGauge from '../components/charts/HygieneScoreGauge';
import PipelineFunnel from '../components/charts/PipelineFunnel';

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await ApiClient.get('/dashboard/summary');
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner size="lg" message="Aggregating pipeline hygiene metrics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', border: '1px solid var(--danger-border)' }}>
        <AlertTriangle size={36} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Failed to Load Dashboard</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
        <button onClick={fetchDashboardData} className="btn btn-primary btn-sm">
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    );
  }

  const { metrics, stageCounts, stageValues, hygieneBreakdown, dealsAtRisk, recentMeetings } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Pipeline Hygiene & Velocity
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Real-time pipeline audit & autonomous voice commitment logger
          </p>
        </div>

        <button onClick={fetchDashboardData} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Metrics
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <StatCard
          title="Total Pipeline Value"
          value={`$${(metrics?.totalPipelineValue || 0).toLocaleString()}`}
          subtitle={`${metrics?.totalDeals || 0} active opportunities`}
          icon={DollarSign}
          trend="+14.2%"
          trendLabel="vs last month"
          color="primary"
        />

        <StatCard
          title="Overall Hygiene Score"
          value={`${metrics?.avgHygieneScore || 0}%`}
          subtitle={`${hygieneBreakdown?.healthy || 0} healthy &bull; ${hygieneBreakdown?.at_risk || 0} at risk`}
          icon={Activity}
          trend={metrics?.avgHygieneScore >= 75 ? '+4%' : '-8%'}
          color={metrics?.avgHygieneScore >= 75 ? 'success' : 'warning'}
        />

        <StatCard
          title="Voice Calls Logged"
          value={metrics?.totalMeetings || 0}
          subtitle="Processed via auto-logger"
          icon={Mic}
          trend="+8 this week"
          color="primary"
        />

        <StatCard
          title="Pending Action Items"
          value={metrics?.pendingActionsCount || 0}
          subtitle="Customer commitments extracted"
          icon={CheckSquare}
          color={metrics?.pendingActionsCount > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Analytics Row: Hygiene Health + Funnel */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Hygiene Health Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Pipeline Health Index</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Audited continuously</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '1rem 0' }}>
            <HygieneScoreGauge score={metrics?.avgHygieneScore || 85} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Healthy:</span>
                <strong>{hygieneBreakdown?.healthy || 0}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)' }} />
                <span style={{ color: 'var(--text-muted)' }}>At Risk:</span>
                <strong>{hygieneBreakdown?.at_risk || 0}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Stale:</span>
                <strong>{hygieneBreakdown?.stale || 0}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline By Stage */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Pipeline Stage Velocity</h3>
            <Link to="/deals" style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              View Pipeline <ArrowUpRight size={14} />
            </Link>
          </div>

          <PipelineFunnel stageCounts={stageCounts} stageValues={stageValues} />
        </div>
      </div>

      {/* Deals At Risk Table */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>Deals Requiring Attention</h3>
          </div>
          <Link to="/deals" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
            All Deals &rarr;
          </Link>
        </div>

        {dealsAtRisk?.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Clean Pipeline!"
            description="Zero deals are currently classified as stale or at-risk. Great job keeping your CRM clean."
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Deal Opportunity</th>
                  <th>Amount</th>
                  <th>Stage</th>
                  <th>Hygiene Score</th>
                  <th>Identified Risks</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {dealsAtRisk?.map((deal) => (
                  <tr key={deal._id}>
                    <td>
                      <div>
                        <strong>{deal.name}</strong>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{deal.accountName}</p>
                      </div>
                    </td>
                    <td>${deal.amount?.toLocaleString()}</td>
                    <td>
                      <Badge variant="neutral">{deal.stage}</Badge>
                    </td>
                    <td>
                      <Badge variant={deal.hygieneStatus}>
                        {deal.hygieneScore}% &bull; {deal.hygieneStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      {deal.riskReasons?.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--warning)' }}>
                          {deal.riskReasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Stale close date</span>
                      )}
                    </td>
                    <td>{deal.ownerId?.name || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Voice Logged Meetings */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mic size={18} style={{ color: 'var(--accent-cyan)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>Recent Voice Meetings</h3>
          </div>
          <Link to="/meetings" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
            All Meetings &rarr;
          </Link>
        </div>

        {recentMeetings?.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="No voice meetings logged yet"
            description="Log your first customer conversation to automatically capture notes and action items."
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>Client / Account</th>
                  <th>Platform</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>CRM Sync</th>
                </tr>
              </thead>
              <tbody>
                {recentMeetings?.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <div>
                        <strong>{m.title}</strong>
                        {m.summary?.overview && (
                          <p style={{ fontSize: '0.785rem', color: 'var(--text-muted)', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.summary.overview}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>{m.clientName}</td>
                    <td>
                      <Badge variant="neutral">{m.platform.replace('_', ' ')}</Badge>
                    </td>
                    <td>{new Date(m.scheduledStartTime).toLocaleDateString()}</td>
                    <td>
                      <Badge variant={m.status === 'completed' ? 'success' : 'neutral'}>{m.status}</Badge>
                    </td>
                    <td>
                      <Badge variant={m.crmSyncStatus === 'synced' ? 'success' : 'warning'}>
                        {m.crmSyncStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
