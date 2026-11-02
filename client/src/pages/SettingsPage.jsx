import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Users,
  Shield,
  Plus,
  RefreshCw,
  Lock,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import ApiClient from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

const SettingsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('organization');

  // Org Settings State
  const [org, setOrg] = useState(null);
  const [team, setTeam] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('rep');
  const [inviteTitle, setInviteTitle] = useState('Account Executive');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const fetchSettingsData = async () => {
    setIsLoading(true);
    try {
      const [orgRes, teamRes] = await Promise.all([
        ApiClient.get('/settings/organization'),
        ApiClient.get('/settings/team'),
      ]);

      if (orgRes.success) setOrg(orgRes.data);
      if (teamRes.success) setTeam(teamRes.data);

      if (user?.role === 'admin') {
        const auditRes = await ApiClient.get('/settings/audit-logs');
        if (auditRes.success) setAuditLogs(auditRes.data?.logs || []);
      }
    } catch (err) {
      console.error('Settings load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, [user]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteSubmitting(true);
    setInviteError('');

    try {
      const res = await ApiClient.post('/settings/team/invite', {
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        title: inviteTitle,
      });

      if (res.success) {
        setIsInviteOpen(false);
        setInviteName('');
        setInviteEmail('');
        fetchSettingsData();
      }
    } catch (err) {
      setInviteError(err.message || 'Failed to invite team member.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          Organization & System Settings
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Manage organization tenancy, team access roles, and security audit trails
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs-scroll-container" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('organization')}
          className={`btn btn-sm ${activeTab === 'organization' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Building size={14} /> Organization Profile
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`btn btn-sm ${activeTab === 'team' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={14} /> Team & Permissions
        </button>

        {user?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Shield size={14} /> Audit Trail & Compliance
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" message="Loading settings and credentials..." />
        </div>
      ) : (
        <>
          {/* Tab 1: Organization Settings */}
          {activeTab === 'organization' && (
            <div className="card" style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Tenant Parameters</h3>
                <Badge variant="primary">{org?.plan || 'Professional'} Tier</Badge>
              </div>

              <div className="responsive-grid-2col">
                <div>
                  <label style={{ display: 'block', fontSize: '0.785rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Organization Name
                  </label>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>{org?.name}</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.785rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Corporate Domain (Tenancy Boundary)
                  </label>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>{org?.domain}</p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                  Auto-Logger Hygiene Policies
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>Autonomous CRM Sync</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Automatically log verified meeting action items into CRM
                      </p>
                    </div>
                    <Badge variant={org?.settings?.autoLogEnabled ? 'success' : 'neutral'}>
                      {org?.settings?.autoLogEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>Hygiene Sensitivity</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Strictly flags stale deals if uncontacted after 14 days
                      </p>
                    </div>
                    <Badge variant="neutral">{org?.settings?.hygieneSensitivity || 'standard'}</Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>Voice Transcript Retention</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Retain customer audio recordings for compliance
                      </p>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>
                      {org?.settings?.dataRetentionDays || 90} Days
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Team Members */}
          {activeTab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Active Team Members ({team.length})
                </h3>

                {user?.role === 'admin' && (
                  <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary btn-sm">
                    <Plus size={14} /> Invite Member
                  </button>
                )}
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Title</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((member) => (
                      <tr key={member._id}>
                        <td>
                          <strong>{member.name}</strong>
                        </td>
                        <td>{member.email}</td>
                        <td>{member.title}</td>
                        <td>
                          <Badge variant={member.role === 'admin' ? 'primary' : 'neutral'}>{member.role}</Badge>
                        </td>
                        <td>
                          <Badge variant={member.isActive ? 'success' : 'danger'}>
                            {member.isActive ? 'Active' : 'Deactivated'}
                          </Badge>
                        </td>
                        <td>{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Security & Audit Trail */}
          {activeTab === 'audit' && user?.role === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Compliance & Security Audit Trail
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Immutable tenant log tracking authentication, deal modifications, and integration access
                  </p>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Actor</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log._id}>
                        <td style={{ fontSize: '0.785rem', color: 'var(--text-dim)' }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--primary)' }}>
                            {log.action}
                          </code>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem' }}>{log.entityType}</span>
                        </td>
                        <td>{log.userEmail || 'System'}</td>
                        <td style={{ fontSize: '0.785rem', color: 'var(--text-dim)' }}>{log.ipAddress || '127.0.0.1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invite Member Modal */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite Team Member">
        {inviteError && (
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
            {inviteError}
          </div>
        )}

        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Jordan Blake"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Corporate Email *
            </label>
            <input
              type="email"
              required
              placeholder="jordan@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Role
              </label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="rep">Sales Representative</option>
                <option value="manager">Sales Manager</option>
                <option value="admin">Platform Admin</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Job Title
              </label>
              <input
                type="text"
                value={inviteTitle}
                onChange={(e) => setInviteTitle(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsInviteOpen(false)} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={inviteSubmitting}>
              {inviteSubmitting ? 'Inviting...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SettingsPage;
