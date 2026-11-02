import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Edit3,
  ExternalLink,
  History,
  Settings,
  Filter,
  Search,
  Quote,
  ArrowRight,
  Database,
  CheckSquare,
  Clock,
  Layers,
  Sparkles,
  Info,
  RefreshCw,
} from 'lucide-react';
import ApiClient from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const ApprovalCenterPage = () => {
  const { user } = useAuth();
  const socket = useSocket();

  const [actions, setActions] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, completed: 0, failed: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending_approval'); // 'pending_approval' | 'approved' | 'completed' | 'failed' | 'rejected' | 'all'
  const [providerFilter, setProviderFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [confirmApproveAction, setConfirmApproveAction] = useState(null);
  const [editActionData, setEditActionData] = useState(null);
  const [rejectActionData, setRejectActionData] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [historyActionData, setHistoryActionData] = useState(null);
  const [actionHistory, setActionHistory] = useState([]);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  // Operation processing state
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchActions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        if (activeTab === 'completed' || activeTab === 'failed') {
          params.set('executionStatus', activeTab);
        } else {
          params.set('approvalStatus', activeTab);
        }
      }
      if (providerFilter) params.set('provider', providerFilter);
      if (riskFilter) params.set('riskLevel', riskFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await ApiClient.get(`/automation/actions?${params.toString()}`);
      if (res.success && res.data) {
        setActions(res.data.actions || []);
        if (res.data.counts) setCounts(res.data.counts);
      }
    } catch (err) {
      console.error('Failed to load approval actions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await ApiClient.get('/automation/settings');
      if (res.success && res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to load automation settings:', err);
    }
  };

  useEffect(() => {
    fetchActions();
    fetchSettings();
  }, [activeTab, providerFilter, riskFilter]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchActions();
    };

    socket.on('automation:approval-required', handleUpdate);
    socket.on('automation:action-approved', handleUpdate);
    socket.on('automation:action-rejected', handleUpdate);
    socket.on('automation:execution-completed', handleUpdate);
    socket.on('automation:execution-failed', handleUpdate);

    return () => {
      socket.off('automation:approval-required', handleUpdate);
      socket.off('automation:action-approved', handleUpdate);
      socket.off('automation:action-rejected', handleUpdate);
      socket.off('automation:execution-completed', handleUpdate);
      socket.off('automation:execution-failed', handleUpdate);
    };
  }, [socket]);

  // Approve Handler
  const handleApprove = async (action) => {
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post(`/automation/actions/${action._id}/approve`, {
        comments: 'Approved from Human Approval Center dashboard.',
      });
      if (res.success) {
        setConfirmApproveAction(null);
        setActionMessage({ type: 'success', text: `Action "${action.title}" approved. You can now execute it.` });
        fetchActions();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to approve action.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Reject Handler
  const handleReject = async () => {
    if (!rejectActionData) return;
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post(`/automation/actions/${rejectActionData._id}/reject`, {
        reason: rejectionReason || 'Rejected by human reviewer.',
      });
      if (res.success) {
        setRejectActionData(null);
        setRejectionReason('');
        setActionMessage({ type: 'success', text: 'Action proposal has been rejected.' });
        fetchActions();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to reject action.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Handler
  const handleExecute = async (action) => {
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post(`/automation/actions/${action._id}/execute`);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Action successfully executed against ${action.provider.toUpperCase()}! External ID: ${res.data.externalRecordId}`,
        });
        fetchActions();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Execution failed.' });
      fetchActions();
    } finally {
      setSubmitting(false);
    }
  };

  // Retry Handler
  const handleRetry = async (action) => {
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post(`/automation/actions/${action._id}/retry`);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Action retried and executed successfully.' });
        fetchActions();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Retry failed.' });
      fetchActions();
    } finally {
      setSubmitting(false);
    }
  };

  // Edit and Save
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editActionData) return;
    setSubmitting(true);
    try {
      const res = await ApiClient.patch(`/automation/actions/${editActionData._id}`, {
        title: editActionData.title,
        description: editActionData.description,
        proposedPayload: editActionData.proposedPayload,
      });
      if (res.success) {
        setEditActionData(null);
        setActionMessage({
          type: 'success',
          text: 'Action updated. Note: Prior approval was safely reset for fresh human sign-off.',
        });
        fetchActions();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update action.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Load History
  const handleViewHistory = async (action) => {
    setHistoryActionData(action);
    try {
      const res = await ApiClient.get(`/automation/actions/${action._id}/history`);
      if (res.success) {
        setActionHistory(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await ApiClient.patch('/automation/settings', settings);
      if (res.success) {
        setSettingsModalOpen(false);
        setActionMessage({ type: 'success', text: 'Automation settings updated successfully.' });
      }
    } catch (err) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setSubmitting(false);
    }
  };

  const canApproveOrExecute = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="page-header-container">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Human Approval Center
            </h2>
            {counts.pending > 0 && (
              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: '1px solid var(--danger-border)',
                }}
              >
                {counts.pending} pending
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            AI proposes. Humans approve. DealFlow executes — Zero unauthorized CRM writes or untracked Jira tickets.
          </p>
        </div>

        <div className="page-header-actions">
          {user?.role === 'admin' && (
            <button onClick={() => setSettingsModalOpen(true)} className="btn btn-secondary btn-sm">
              <Settings size={14} /> Automation Settings
            </button>
          )}
          <button onClick={fetchActions} className="btn btn-secondary btn-sm" disabled={isLoading}>
            <RotateCcw size={14} className={isLoading ? 'spin-animation' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Global Status Message */}
      {actionMessage && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: actionMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${actionMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-scroll-container" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        {[
          { id: 'pending_approval', label: `Pending Approval (${counts.pending})` },
          { id: 'approved', label: `Approved & Ready (${counts.approved})` },
          { id: 'completed', label: `Completed (${counts.completed})` },
          { id: 'failed', label: `Failed (${counts.failed})` },
          { id: 'rejected', label: 'Rejected' },
          { id: 'all', label: `All Proposals (${counts.total})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.65rem 1rem',
              fontSize: '0.85rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="card filter-toolbar">
        <div className="filter-search">
          <Search size={16} className="filter-group-icon" />
          <input
            type="text"
            placeholder="Search proposals by title, record, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchActions()}
          />
        </div>

        <div className="filter-group">
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter by provider"
          >
            <option value="">All Providers</option>
            <option value="hubspot">HubSpot CRM</option>
            <option value="jira">Atlassian Jira</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="filter-select"
            aria-label="Filter by risk level"
          >
            <option value="">All Risk Levels</option>
            <option value="high">High Risk (Deal Commercials)</option>
            <option value="medium">Medium Risk (Jira Tasks)</option>
            <option value="low">Low Risk (Notes)</option>
          </select>
        </div>

        <div className="filter-actions">
          <button onClick={fetchActions} className="btn btn-secondary btn-sm" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Action Cards List */}
      {isLoading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" message="Loading approval items and evidence..." />
        </div>
      ) : actions.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <ShieldCheck size={42} style={{ color: 'var(--text-dim)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>No Actions in this Queue</h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
            {activeTab === 'pending_approval'
              ? 'All proposals have been signed off. When new recorded meetings are analyzed by the AI engine, proposed changes will appear here for human authorization.'
              : 'No action records match your current filter selection.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {actions.map((action) => {
            const isPending = action.approvalStatus === 'pending_approval';
            const isApproved = action.approvalStatus === 'approved';
            const isRejected = action.approvalStatus === 'rejected';
            const isCompleted = action.executionStatus === 'completed';
            const isFailed = action.executionStatus === 'failed';

            const providerColor = action.provider === 'hubspot' ? '#ff7a59' : '#0052cc';
            const ProviderIcon = action.provider === 'hubspot' ? Database : CheckSquare;

            return (
              <div
                key={action._id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  borderLeft: `4px solid ${
                    isCompleted
                      ? 'var(--success)'
                      : isFailed
                      ? 'var(--danger)'
                      : isApproved
                      ? 'var(--primary)'
                      : action.riskLevel === 'high'
                      ? 'var(--danger)'
                      : 'var(--warning)'
                  }`,
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        background: `${providerColor}18`,
                        color: providerColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ProviderIcon size={16} />
                    </div>

                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{action.title}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        <span>Target: <strong>{action.targetRecordName || action.targetRecordId}</strong></span>
                        {action.dealId?.name && <span>• Deal: <strong>{action.dealId.name}</strong></span>}
                        {action.meetingId?.title && <span>• Meeting: <strong>{action.meetingId.title}</strong></span>}
                        <span>• Proposed {new Date(action.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {/* Risk Badge */}
                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          action.riskLevel === 'high'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : action.riskLevel === 'medium'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                        color:
                          action.riskLevel === 'high'
                            ? 'var(--danger)'
                            : action.riskLevel === 'medium'
                            ? 'var(--warning)'
                            : 'var(--success)',
                      }}
                    >
                      {action.riskLevel} Risk
                    </span>

                    {/* Status Badge */}
                    <Badge variant={isCompleted ? 'success' : isFailed ? 'danger' : isApproved ? 'info' : isRejected ? 'danger' : 'warning'}>
                      {isCompleted
                        ? 'Completed'
                        : isFailed
                        ? 'Failed'
                        : isApproved
                        ? 'Approved (Ready)'
                        : isRejected
                        ? 'Rejected'
                        : 'Pending Approval'}
                    </Badge>
                  </div>
                </div>

                {/* Description & AI Reason */}
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <p>{action.description}</p>
                  {action.reason && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem', color: 'var(--text-dim)', fontSize: '0.775rem' }}>
                      <Sparkles size={12} style={{ color: 'var(--primary)' }} />
                      <span><strong>AI Rationale:</strong> {action.reason}</span>
                    </div>
                  )}
                </div>

                {/* Proposed vs Original comparison block (if deal properties modified) */}
                {action.actionType === 'hubspot_update_deal' && (
                  <div
                    style={{
                      background: 'var(--bg-main)',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.75rem',
                      fontSize: '0.8rem',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.7rem' }}>CURRENT VALUE</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                        {action.originalPayload?.stage ? `Stage: ${action.originalPayload.stage}` : '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--primary)', display: 'block', fontSize: '0.7rem', fontWeight: 700 }}>PROPOSED VALUE (AI)</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {action.proposedPayload?.stage ? `Stage: ${action.proposedPayload.stage.toUpperCase()}` : ''}
                        {action.proposedPayload?.amount ? ` | Amount: $${action.proposedPayload.amount}` : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Transcript Evidence Box */}
                {action.evidence?.quote && (
                  <div
                    style={{
                      background: 'rgba(99, 102, 241, 0.05)',
                      borderLeft: '3px solid var(--primary)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                    }}
                  >
                    <Quote size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }} />
                    <div>
                      <span style={{ fontStyle: 'italic', color: 'var(--text-main)' }}>
                        "{action.evidence.quote}"
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                        — {action.evidence.speaker || 'Customer'}
                        {action.evidence.startTime > 0 && ` (Timestamp: ${Math.floor(action.evidence.startTime)}s)`}
                      </div>
                    </div>
                  </div>
                )}

                {/* Execution Results or Error message */}
                {isCompleted && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.775rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle size={14} />
                      <span>Confirmed by {action.provider.toUpperCase()} (ID: {action.externalRecordId}) at {new Date(action.executedAt).toLocaleTimeString()}</span>
                    </div>
                    {action.externalRecordUrl && (
                      <a href={action.externalRecordUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                        <ExternalLink size={12} /> View External Record
                      </a>
                    )}
                  </div>
                )}

                {isFailed && action.executionError && (
                  <div style={{ padding: '0.6rem 0.85rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.775rem', color: 'var(--danger)' }}>
                    <strong>Execution Error:</strong> {action.executionError.message || 'Provider rejected payload'}
                  </div>
                )}

                {/* Footer Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <button onClick={() => handleViewHistory(action)} className="btn btn-secondary btn-sm" style={{ color: 'var(--text-dim)' }}>
                    <History size={13} /> View Audit History
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Pending Controls */}
                    {isPending && canApproveOrExecute && (
                      <>
                        <button
                          onClick={() => setRejectActionData(action)}
                          className="btn btn-danger btn-sm"
                          disabled={submitting}
                        >
                          <XCircle size={13} /> Reject
                        </button>
                        <button
                          onClick={() => setEditActionData(action)}
                          className="btn btn-secondary btn-sm"
                          disabled={submitting}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          onClick={() => setConfirmApproveAction(action)}
                          className="btn btn-primary btn-sm"
                          disabled={submitting}
                        >
                          <CheckCircle size={13} /> Approve
                        </button>
                      </>
                    )}

                    {/* Approved & Ready Controls */}
                    {isApproved && !isCompleted && canApproveOrExecute && (
                      <>
                        <button
                          onClick={() => setEditActionData(action)}
                          className="btn btn-secondary btn-sm"
                          disabled={submitting}
                        >
                          <Edit3 size={13} /> Edit (Will Reset Approval)
                        </button>
                        <button
                          onClick={() => handleExecute(action)}
                          className="btn btn-primary btn-sm"
                          style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                          disabled={submitting}
                        >
                          <Play size={13} /> {submitting ? 'Executing...' : 'Execute Now'}
                        </button>
                      </>
                    )}

                    {/* Failed Controls */}
                    {isFailed && canApproveOrExecute && (
                      <button
                        onClick={() => handleRetry(action)}
                        className="btn btn-primary btn-sm"
                        disabled={submitting}
                      >
                        <RotateCcw size={13} /> Retry Execution
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: APPROVE CONFIRMATION ================= */}
      <Modal
        isOpen={Boolean(confirmApproveAction)}
        onClose={() => setConfirmApproveAction(null)}
        title="Authorize External Write Operation"
      >
        {confirmApproveAction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {confirmApproveAction.riskLevel === 'high' && (
              <div
                style={{
                  padding: '0.85rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--danger-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.825rem',
                  color: 'var(--danger)',
                  display: 'flex',
                  gap: '0.6rem',
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>High Commercial Significance:</strong> This action will modify deal values or stages on external CRM records once executed. Please verify transcript evidence before proceeding.
                </span>
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
              Are you sure you want to approve <strong>"{confirmApproveAction.title}"</strong> for execution against <strong>{confirmApproveAction.provider.toUpperCase()}</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={() => setConfirmApproveAction(null)} className="btn btn-secondary btn-sm" disabled={submitting}>
                Cancel
              </button>
              <button
                onClick={() => handleApprove(confirmApproveAction)}
                className="btn btn-primary btn-sm"
                disabled={submitting}
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= MODAL: EDIT ACTION ================= */}
      <Modal
        isOpen={Boolean(editActionData)}
        onClose={() => setEditActionData(null)}
        title="Edit Proposed Action Payload"
      >
        {editActionData && (
          <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <Info size={13} style={{ display: 'inline', marginRight: '0.3rem' }} />
              Modifying an action updates its version and resets any prior approval, requiring explicit human sign-off.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Action Title
              </label>
              <input
                type="text"
                value={editActionData.title}
                onChange={(e) => setEditActionData({ ...editActionData, title: e.target.value })}
                className="input-field"
                required
              />
            </div>

            {/* Jira-specific editable fields */}
            {editActionData.provider === 'jira' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                      Project Key
                    </label>
                    <input
                      type="text"
                      value={editActionData.proposedPayload?.projectKey || ''}
                      onChange={(e) =>
                        setEditActionData({
                          ...editActionData,
                          proposedPayload: { ...editActionData.proposedPayload, projectKey: e.target.value.toUpperCase() },
                        })
                      }
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                      Priority
                    </label>
                    <select
                      value={editActionData.proposedPayload?.priority || 'Medium'}
                      onChange={(e) =>
                        setEditActionData({
                          ...editActionData,
                          proposedPayload: { ...editActionData.proposedPayload, priority: e.target.value },
                        })
                      }
                      className="input-field"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    Task Description
                  </label>
                  <textarea
                    rows={4}
                    value={editActionData.proposedPayload?.description || ''}
                    onChange={(e) =>
                      setEditActionData({
                        ...editActionData,
                        proposedPayload: { ...editActionData.proposedPayload, description: e.target.value },
                      })
                    }
                    className="input-field"
                  />
                </div>
              </>
            )}

            {/* HubSpot-specific editable fields */}
            {editActionData.actionType === 'hubspot_update_deal' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    Proposed Stage
                  </label>
                  <select
                    value={editActionData.proposedPayload?.stage || 'discovery'}
                    onChange={(e) =>
                      setEditActionData({
                        ...editActionData,
                        proposedPayload: { ...editActionData.proposedPayload, stage: e.target.value },
                      })
                    }
                    className="input-field"
                  >
                    <option value="discovery">Discovery</option>
                    <option value="qualification">Qualification</option>
                    <option value="demo">Demo / Presentation</option>
                    <option value="proposal">Proposal / Contract</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed_won">Closed Won</option>
                    <option value="closed_lost">Closed Lost</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    Proposed Amount ($)
                  </label>
                  <input
                    type="number"
                    value={editActionData.proposedPayload?.amount || ''}
                    onChange={(e) =>
                      setEditActionData({
                        ...editActionData,
                        proposedPayload: { ...editActionData.proposedPayload, amount: e.target.value },
                      })
                    }
                    className="input-field"
                  />
                </div>
              </div>
            )}

            {editActionData.actionType === 'hubspot_create_note' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  CRM Meeting Note Content
                </label>
                <textarea
                  rows={5}
                  value={editActionData.proposedPayload?.noteBody || ''}
                  onChange={(e) =>
                    setEditActionData({
                      ...editActionData,
                      proposedPayload: { ...editActionData.proposedPayload, noteBody: e.target.value },
                    })
                  }
                  className="input-field"
                  required
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setEditActionData(null)} className="btn btn-secondary btn-sm" disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save & Request Approval'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ================= MODAL: REJECT ACTION ================= */}
      <Modal
        isOpen={Boolean(rejectActionData)}
        onClose={() => setRejectActionData(null)}
        title="Reject Proposed Action"
      >
        {rejectActionData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
              Rejecting <strong>"{rejectActionData.title}"</strong> will prevent any external API write.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Rejection Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Customer decided to postpone renewal, evidence misattributed"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setRejectActionData(null)} className="btn btn-secondary btn-sm" disabled={submitting}>
                Cancel
              </button>
              <button onClick={handleReject} className="btn btn-danger btn-sm" disabled={submitting}>
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= MODAL: ACTION AUDIT HISTORY ================= */}
      <Modal
        isOpen={Boolean(historyActionData)}
        onClose={() => setHistoryActionData(null)}
        title={`Audit Lifecycle History: ${historyActionData?.title}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '420px', overflowY: 'auto' }}>
          {actionHistory.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>No history records found.</p>
          ) : (
            actionHistory.map((item, idx) => (
              <div
                key={item._id || idx}
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-main)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                    {item.operation}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.725rem' }}>
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  User: <strong>{item.userId?.name || item.userId?.email || 'System'}</strong>
                </div>
                {item.comments && (
                  <div style={{ color: 'var(--text-dim)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                    "{item.comments}"
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* ================= MODAL: AUTOMATION SETTINGS ================= */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="Organization Automation & Proposal Settings"
      >
        {settings && (
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.proposalGenerationEnabled}
                  onChange={(e) => setSettings({ ...settings, proposalGenerationEnabled: e.target.checked })}
                />
                <span>Enable AI Action Proposal Generation on Completed Meetings</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.hubspotProposalsEnabled}
                  onChange={(e) => setSettings({ ...settings, hubspotProposalsEnabled: e.target.checked })}
                />
                <span>Enable HubSpot CRM Deal & Note Proposals</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.jiraProposalsEnabled}
                  onChange={(e) => setSettings({ ...settings, jiraProposalsEnabled: e.target.checked })}
                />
                <span>Enable Jira Task Proposals for Extracted Commitments</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Default Jira Project Key
                </label>
                <input
                  type="text"
                  value={settings.defaultJiraProjectKey || 'CRM'}
                  onChange={(e) => setSettings({ ...settings, defaultJiraProjectKey: e.target.value.toUpperCase() })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Default Priority
                </label>
                <select
                  value={settings.defaultJiraPriority || 'Medium'}
                  onChange={(e) => setSettings({ ...settings, defaultJiraPriority: e.target.value })}
                  className="input-field"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setSettingsModalOpen(false)} className="btn btn-secondary btn-sm" disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalCenterPage;
