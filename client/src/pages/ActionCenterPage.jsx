import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  Quote,
  CheckCircle,
  Circle,
  AlertCircle,
  Filter,
  RefreshCw,
  Send,
  Trash2,
  Calendar,
  User,
} from 'lucide-react';
import ApiClient from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';

const ActionCenterPage = () => {
  const { user } = useAuth();
  const [actions, setActions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    responsibleParty: 'internal',
    contextQuote: '',
    dueDate: '',
    priority: 'medium',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchActions = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get('/actions', {
        status: statusFilter,
        priority: priorityFilter,
      });
      if (res.success && res.data) {
        setActions(res.data);
      }
    } catch (err) {
      console.error('Fetch actions failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [statusFilter, priorityFilter]);

  const handleCreateAction = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    try {
      const res = await ApiClient.post('/actions', {
        title: form.title,
        task: form.title,
        description: form.description,
        responsibleParty: form.responsibleParty,
        contextQuote: form.contextQuote,
        dueDate: form.dueDate,
        priority: form.priority,
      });

      if (res.success) {
        setIsModalOpen(false);
        setForm({
          title: '',
          description: '',
          responsibleParty: 'internal',
          contextQuote: '',
          dueDate: '',
          priority: 'medium',
        });
        fetchActions();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create action item.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await ApiClient.patch(`/actions/${item._id}/status`, { status: nextStatus });
      setActions(actions.map((a) => (a._id === item._id ? { ...a, status: nextStatus } : a)));
    } catch (err) {
      alert(err.message || 'Failed to update action status');
    }
  };

  const handleDeleteAction = async (itemId) => {
    if (!window.confirm('Delete this action commitment?')) return;
    try {
      await ApiClient.delete(`/actions/${itemId}`);
      setActions(actions.filter((a) => a._id !== itemId));
    } catch (err) {
      alert(err.message || 'Failed to delete action');
    }
  };

  const handleSyncToCrm = async (item) => {
    try {
      await ApiClient.patch(`/actions/${item._id}/status`, { crmSyncStatus: 'synced' });
      setActions(actions.map((a) => (a._id === item._id ? { ...a, crmSyncStatus: 'synced' } : a)));
    } catch (err) {
      alert(err.message || 'Failed to sync to CRM');
    }
  };

  const filteredActions = actions.filter((item) => {
    if (partyFilter && (item.responsibleParty || 'internal') !== partyFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="page-header-container">
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Action Center & Commitments
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Voice-extracted customer deliverables, follow-ups, and CRM task synchronization
          </p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
          <Plus size={16} /> New Action Item
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card filter-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--text-dim)' }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={partyFilter}
          onChange={(e) => setPartyFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 160 }}
        >
          <option value="">All Responsible Parties</option>
          <option value="internal">Internal Actions</option>
          <option value="customer">Customer Deliverables</option>
        </select>

        <button onClick={fetchActions} className="btn btn-secondary btn-sm" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Action Items List */}
      {isLoading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" message="Loading customer action items..." />
        </div>
      ) : filteredActions.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No action items found"
          description="All voice-extracted commitments have been resolved or no action items match your filters."
          actionLabel="Add Commitment"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredActions.map((item) => {
            const quote = item.evidence?.quote || item.contextQuote;
            const title = item.title || item.task;
            const isCustomer = item.responsibleParty === 'customer';

            return (
              <div
                key={item._id}
                className="card action-card-row"
                style={{
                  opacity: item.status === 'completed' ? 0.65 : 1,
                  borderLeft:
                    item.priority === 'urgent'
                      ? '4px solid var(--danger)'
                      : item.priority === 'high'
                      ? '4px solid var(--warning)'
                      : '4px solid var(--primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1 }}>
                  <button
                    onClick={() => handleToggleStatus(item)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: item.status === 'completed' ? 'var(--success)' : 'var(--text-dim)',
                      cursor: 'pointer',
                      marginTop: '0.15rem',
                    }}
                    title="Toggle status"
                  >
                    {item.status === 'completed' ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                        }}
                      >
                        {title}
                      </span>

                      <Badge variant={isCustomer ? 'warning' : 'primary'}>
                        {isCustomer ? 'Customer Deliverable' : 'Internal Action'}
                      </Badge>

                      <Badge
                        variant={
                          item.priority === 'urgent'
                            ? 'danger'
                            : item.priority === 'high'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {item.priority}
                      </Badge>

                      <Badge variant={item.crmSyncStatus === 'synced' ? 'success' : 'neutral'}>
                        CRM: {item.crmSyncStatus?.replace('_', ' ') || 'pending'}
                      </Badge>
                    </div>

                    {item.description && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        {item.description}
                      </p>
                    )}

                    {quote && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius-xs)',
                          borderLeft: '2px solid var(--border-light)',
                        }}
                      >
                        <Quote size={12} style={{ flexShrink: 0, color: 'var(--accent-cyan)' }} />
                        <span>"{quote}"</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.785rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                      {item.dueDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={12} />
                          Due: {new Date(item.dueDate).toLocaleDateString()}
                        </div>
                      )}
                      {item.dealId && <span>Linked Deal: {item.dealId.name || 'Deal'}</span>}
                      {item.assignedTo && <span>Assigned to: {item.assignedTo}</span>}
                    </div>
                  </div>
                </div>

                <div className="action-card-actions">
                  {item.crmSyncStatus !== 'synced' && item.status !== 'completed' && (
                    <button
                      onClick={() => handleSyncToCrm(item)}
                      className="btn btn-secondary btn-sm"
                      title="Sync this task into connected CRM"
                    >
                      <Send size={13} /> Sync to CRM
                    </button>
                  )}

                  {['admin', 'manager'].includes(user?.role) && (
                    <button
                      onClick={() => handleDeleteAction(item._id)}
                      className="btn btn-danger btn-sm"
                      title="Delete action item"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Action Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log New Commitment / Action Item">
        {formError && (
          <div
            style={{
              padding: '0.75rem',
              background: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleCreateAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Action Task Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Deliver revised MSA with EU privacy redlines"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Responsible Party *
            </label>
            <select
              value={form.responsibleParty}
              onChange={(e) => setForm({ ...form, responsibleParty: e.target.value })}
            >
              <option value="internal">Internal Team Action (Our Rep / Sales Eng)</option>
              <option value="customer">Customer Deliverable (Client Stakeholder)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Extracted Voice Context Quote
            </label>
            <input
              type="text"
              placeholder="e.g. CTO: We need the redlines delivered before the Friday freeze."
              value={form.contextQuote}
              onChange={(e) => setForm({ ...form, contextQuote: e.target.value })}
            />
          </div>

          <div className="responsive-grid-2col">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Priority
              </label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Due Date *
              </label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={formSubmitting}>
              {formSubmitting ? 'Saving...' : 'Add Action Item'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ActionCenterPage;
