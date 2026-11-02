import React, { useState, useEffect } from 'react';
import {
  Video,
  PhoneCall,
  Database,
  CheckSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Lock,
  Settings,
  Key,
  Copy,
  Check,
  Play,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import ApiClient from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

const PROVIDER_METADATA = {
  zoom: {
    name: 'Zoom Meetings & RTMS',
    category: 'Live Voice & Video',
    description: 'Capture live meetings using Real-Time Media Streams (RTMS) and ingest cloud recordings via webhook signature verification.',
    icon: Video,
    color: '#0b5cff',
    authType: 'OAuth & Webhook HMAC',
    features: ['RTMS live audio ingestion', 'HMAC-SHA256 webhook verification', 'Cloud recording auto-fetch', 'AI speaker diarization'],
  },
  gong: {
    name: 'Gong Call Intelligence',
    category: 'Completed Call Ingestion',
    description: 'Import completed customer calls and transcripts via Gong API v2 with date filtering, speaker extraction, and AI processing.',
    icon: PhoneCall,
    color: '#9013fe',
    authType: 'HTTP Basic Auth (API v2)',
    features: ['API v2 call pagination', 'Transcript monologue parsing', 'Date-range synchronization', 'Customer metadata matching'],
  },
  hubspot: {
    name: 'HubSpot Sales CRM',
    category: 'CRM Synchronization',
    description: 'Bi-directional synchronization of deals, pipelines, and stage hygiene with configurable property mappings.',
    icon: Database,
    color: '#ff7a59',
    authType: 'OAuth 2.0 Web Flow',
    features: ['OAuth 2.0 token refresh', 'Deals and pipeline retrieval', 'Deal mapping & deduplication', 'Automatic hygiene scoring'],
  },
  jira: {
    name: 'Atlassian Jira Cloud',
    category: 'Issue & Task Tracking',
    description: 'Auto-convert meeting action items into Jira tasks and issues formatted in Atlassian Document Format (ADF) via REST API v3.',
    icon: CheckSquare,
    color: '#0052cc',
    authType: 'Atlassian OAuth 2.0 (3LO)',
    features: ['Atlassian 3LO authorization', 'Cloud site & project discovery', 'Native ADF document formatting', 'Action item synchronization'],
  },
};

const IntegrationsPage = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'zoom' | 'gong' | 'hubspot' | 'jira' | null
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Zoom Form State
  const [zoomWebhookSecret, setZoomWebhookSecret] = useState('');
  const [zoomClientId, setZoomClientId] = useState('');
  const [zoomClientSecret, setZoomClientSecret] = useState('');
  const [zoomAccountId, setZoomAccountId] = useState('');

  // Gong Form & Import State
  const [gongAccessKey, setGongAccessKey] = useState('');
  const [gongClientSecret, setGongClientSecret] = useState('');
  const [gongBaseUrl, setGongBaseUrl] = useState('https://api.gong.io');
  const [gongFromDate, setGongFromDate] = useState('');
  const [gongToDate, setGongToDate] = useState('');
  const [gongImportResult, setGongImportResult] = useState(null);

  // HubSpot Form & Sync State
  const [hubspotSyncResult, setHubspotSyncResult] = useState(null);
  const [hubspotManualToken, setHubspotManualToken] = useState('');

  // Jira Form & Test State
  const [jiraCloudId, setJiraCloudId] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [jiraIssueTypeId, setJiraIssueTypeId] = useState('10001');
  const [jiraTestResult, setJiraTestResult] = useState(null);

  const fetchIntegrations = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get('/integrations');
      if (res.success && res.data) {
        setIntegrations(res.data);
      }
    } catch (err) {
      console.error('Fetch integrations error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const getIntegrationData = (provider) => {
    return integrations.find((i) => i.provider === provider) || {
      provider,
      connectionStatus: 'disconnected',
      status: 'disconnected',
      credentialsConfigured: false,
      metadata: {},
    };
  };

  const handleOpenModal = (provider) => {
    setActionMessage(null);
    setGongImportResult(null);
    setHubspotSyncResult(null);
    setJiraTestResult(null);

    const data = getIntegrationData(provider);
    if (provider === 'zoom') {
      setZoomAccountId(data.externalAccountId || '');
      setZoomWebhookSecret('');
    } else if (provider === 'gong') {
      setGongAccessKey(data.externalAccountId || '');
      setGongBaseUrl(data.metadata?.baseUrl || 'https://api.gong.io');
    } else if (provider === 'jira') {
      setJiraCloudId(data.metadata?.cloudId || data.externalAccountId || '');
      setJiraProjectKey(data.metadata?.projectKey || '');
      setJiraIssueTypeId(data.metadata?.issueTypeId || '10001');
    }

    setActiveModal(provider);
  };

  const handleCopyWebhookUrl = () => {
    const origin = window.location.origin.includes('5173')
      ? 'http://localhost:5000'
      : window.location.origin;
    const url = `${origin}/api/v1/webhooks/zoom`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  // 1. Zoom Actions
  const handleSaveZoomConfig = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post('/integrations/zoom/configure', {
        webhookSecret: zoomWebhookSecret,
        clientId: zoomClientId,
        clientSecret: zoomClientSecret,
        accountId: zoomAccountId,
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Zoom settings and credentials saved securely.' });
        fetchIntegrations();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to save Zoom settings.' });
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Gong Actions
  const handleSaveGongConfig = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post('/integrations/gong/configure', {
        accessKey: gongAccessKey,
        clientSecret: gongClientSecret,
        baseUrl: gongBaseUrl,
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Gong credentials verified and saved.' });
        fetchIntegrations();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to verify Gong credentials.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportGongCalls = async () => {
    setSubmitting(true);
    setGongImportResult(null);
    try {
      const res = await ApiClient.post('/integrations/gong/import', {
        fromDateTime: gongFromDate || undefined,
        toDateTime: gongToDate || undefined,
        maxCalls: 20,
      });
      if (res.success) {
        setGongImportResult(res.data);
        setActionMessage({ type: 'success', text: res.message || 'Calls imported successfully.' });
        fetchIntegrations();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Call import failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  // 3. HubSpot Actions
  const handleConnectHubspotOAuth = async () => {
    try {
      setSubmitting(true);
      const res = await ApiClient.get('/integrations/hubspot/auth-url');
      if (res.success && res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to generate HubSpot OAuth URL.' });
      setSubmitting(false);
    }
  };

  const handleSyncHubspotDeals = async () => {
    setSubmitting(true);
    setHubspotSyncResult(null);
    try {
      const res = await ApiClient.post('/integrations/hubspot/sync');
      if (res.success) {
        setHubspotSyncResult(res.data);
        setActionMessage({ type: 'success', text: res.message || 'HubSpot deals synced successfully.' });
        fetchIntegrations();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Deals sync failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Jira Actions
  const handleConnectJiraOAuth = async () => {
    try {
      setSubmitting(true);
      const res = await ApiClient.get('/integrations/jira/auth-url');
      if (res.success && res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to generate Jira OAuth URL.' });
      setSubmitting(false);
    }
  };

  const handleSaveJiraConfig = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post('/integrations/jira/configure', {
        cloudId: jiraCloudId,
        projectKey: jiraProjectKey,
        issueTypeId: jiraIssueTypeId,
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Jira default project configuration updated.' });
        fetchIntegrations();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update Jira configuration.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestJiraTask = async () => {
    setSubmitting(true);
    setJiraTestResult(null);
    try {
      const res = await ApiClient.post('/integrations/jira/test-issue', {
        projectKey: jiraProjectKey,
        issueTypeId: jiraIssueTypeId,
      });
      if (res.success) {
        setJiraTestResult(res.data);
        setActionMessage({ type: 'success', text: res.message || 'Test task created in Jira.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to create test task.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Common Test & Disconnect
  const handleTestConnection = async (provider) => {
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await ApiClient.post(`/integrations/${provider}/test`);
      if (res.success) {
        setActionMessage({ type: 'success', text: `${PROVIDER_METADATA[provider]?.name} connection test passed successfully.` });
        fetchIntegrations();
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Connection test failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (provider) => {
    if (!window.confirm(`Are you sure you want to disconnect ${PROVIDER_METADATA[provider]?.name || provider}? All encrypted credentials will be purged.`)) {
      return;
    }
    setSubmitting(true);
    try {
      await ApiClient.post(`/integrations/${provider}/disconnect`);
      setActiveModal(null);
      fetchIntegrations();
    } catch (err) {
      alert(err.message || 'Failed to disconnect integration');
    } finally {
      setSubmitting(false);
    }
  };

  const originUrl = window.location.origin.includes('5173') ? 'http://localhost:5000' : window.location.origin;
  const webhookEndpoint = `${originUrl}/api/v1/webhooks/zoom`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            External Integrations & Voice Ingestion
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Connect real communication platforms, CRMs, and issue trackers with AES-256 authenticated encryption.
          </p>
        </div>

        <button onClick={fetchIntegrations} className="btn btn-secondary btn-sm" disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} /> Refresh Status
        </button>
      </div>

      {/* Security Architecture Callout */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
        }}
      >
        <Shield size={24} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }} />
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            Zero-Mock Enterprise Integration Policy
          </h4>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            DealFlow AI does not simulate mock integrations. Every provider status reflects real, verified credentials. Tokens are encrypted using <strong>AES-256-GCM</strong> with an isolated encryption key and strict organization tenant boundaries.
          </p>
        </div>
      </div>

      {/* Integration Cards Grid */}
      {isLoading ? (
        <div style={{ padding: '4rem', display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size="lg" message="Loading integration health registry..." />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {['zoom', 'gong', 'hubspot', 'jira'].map((providerKey) => {
            const meta = PROVIDER_METADATA[providerKey];
            const liveState = getIntegrationData(providerKey);
            const isConnected = liveState.connectionStatus === 'connected' || liveState.status === 'connected';
            const isError = liveState.connectionStatus === 'error' || liveState.status === 'error';
            const IconComponent = meta.icon;

            return (
              <div
                key={providerKey}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  border: isConnected
                    ? '1px solid var(--success-border)'
                    : isError
                    ? '1px solid var(--danger-border)'
                    : '1px solid var(--border-subtle)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top provider bar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: 'var(--radius-sm)',
                          background: `${meta.color}18`,
                          color: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconComponent size={22} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {meta.name}
                        </h3>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                          {meta.category}
                        </span>
                      </div>
                    </div>

                    <Badge variant={isConnected ? 'success' : isError ? 'danger' : 'neutral'}>
                      {isConnected ? (
                        <>
                          <CheckCircle size={11} /> Connected
                        </>
                      ) : isError ? (
                        <>
                          <AlertTriangle size={11} /> Error
                        </>
                      ) : (
                        <>
                          <XCircle size={11} /> Disconnected
                        </>
                      )}
                    </Badge>
                  </div>

                  <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1rem' }}>
                    {meta.description}
                  </p>

                  {/* Feature checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
                    {meta.features.map((feature, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        <Check size={12} style={{ color: isConnected ? 'var(--success)' : 'var(--text-dim)' }} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Live Details if connected */}
                  {isConnected && (
                    <div
                      style={{
                        padding: '0.75rem 0.85rem',
                        background: 'var(--bg-main)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      {liveState.externalAccountName && (
                        <div>
                          <strong>Account: </strong> {liveState.externalAccountName}
                        </div>
                      )}
                      {liveState.lastSyncAt && (
                        <div>
                          <strong>Last Sync: </strong> {new Date(liveState.lastSyncAt).toLocaleString()}
                        </div>
                      )}
                      {liveState.healthStatus?.message && (
                        <div style={{ color: liveState.healthStatus.status === 'healthy' ? 'var(--success)' : 'var(--warning)' }}>
                          <strong>Health: </strong> {liveState.healthStatus.message}
                        </div>
                      )}
                    </div>
                  )}

                  {isError && liveState.lastError?.message && (
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--danger-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--danger)',
                        marginTop: '0.5rem',
                      }}
                    >
                      <strong>Error:</strong> {liveState.lastError.message}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div
                  style={{
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                    Auth: <strong style={{ color: 'var(--text-muted)' }}>{meta.authType}</strong>
                  </span>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleOpenModal(providerKey)}
                      className={`btn btn-sm ${isConnected ? 'btn-secondary' : 'btn-primary'}`}
                    >
                      <Settings size={14} /> {isConnected ? 'Manage' : 'Configure'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: ZOOM CONFIGURATION ================= */}
      <Modal
        isOpen={activeModal === 'zoom'}
        onClose={() => setActiveModal(null)}
        title="Zoom Video & Real-Time Streams (RTMS) Integration"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {actionMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: actionMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${actionMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
              }}
            >
              {actionMessage.text}
            </div>
          )}

          {/* Webhook Endpoint Box */}
          <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
              OFFICIAL ZOOM WEBHOOK ENDPOINT URL
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                readOnly
                value={webhookEndpoint}
                className="input-field"
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--bg-card)' }}
              />
              <button onClick={handleCopyWebhookUrl} className="btn btn-secondary btn-sm" title="Copy Webhook URL">
                {copiedWebhook ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
              </button>
            </div>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
              Register this URL in your Zoom Marketplace App. Supports automated URL validation challenges and HMAC-SHA256 signature verification.
            </p>
          </div>

          <form onSubmit={handleSaveZoomConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Zoom Webhook Secret Token
              </label>
              <input
                type="password"
                placeholder="Enter Zoom Webhook Secret Token for HMAC-SHA256 verification"
                value={zoomWebhookSecret}
                onChange={(e) => setZoomWebhookSecret(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Client ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Zoom App Client ID"
                  value={zoomClientId}
                  onChange={(e) => setZoomClientId(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Account ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Zoom Account ID"
                  value={zoomAccountId}
                  onChange={(e) => setZoomAccountId(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              {getIntegrationData('zoom').connectionStatus === 'connected' && (
                <button
                  type="button"
                  onClick={() => handleDisconnect('zoom')}
                  className="btn btn-danger btn-sm"
                  disabled={submitting}
                >
                  Disconnect
                </button>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => handleTestConnection('zoom')}
                  className="btn btn-secondary btn-sm"
                  disabled={submitting}
                >
                  Test Connection
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      {/* ================= MODAL: GONG CONFIGURATION & IMPORT ================= */}
      <Modal
        isOpen={activeModal === 'gong'}
        onClose={() => setActiveModal(null)}
        title="Gong Call Intelligence Integration"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {actionMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: actionMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${actionMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
              }}
            >
              {actionMessage.text}
            </div>
          )}

          {/* Section 1: Credentials */}
          <form onSubmit={handleSaveGongConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
              Gong API v2 Credentials
            </h4>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Access Key
              </label>
              <input
                type="text"
                placeholder="Gong API Access Key"
                value={gongAccessKey}
                onChange={(e) => setGongAccessKey(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Client Secret
              </label>
              <input
                type="password"
                placeholder="Gong Client Secret"
                value={gongClientSecret}
                onChange={(e) => setGongClientSecret(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                API Base URL
              </label>
              <input
                type="text"
                value={gongBaseUrl}
                onChange={(e) => setGongBaseUrl(e.target.value)}
                className="input-field"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Save & Verify Credentials'}
              </button>
            </div>
          </form>

          {/* Section 2: Call Ingestion (only if connected) */}
          {getIntegrationData('gong').connectionStatus === 'connected' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Import Completed Calls & Transcripts
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                    From Date
                  </label>
                  <input
                    type="date"
                    value={gongFromDate}
                    onChange={(e) => setGongFromDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                    To Date
                  </label>
                  <input
                    type="date"
                    value={gongToDate}
                    onChange={(e) => setGongToDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => handleDisconnect('gong')}
                  className="btn btn-danger btn-sm"
                  disabled={submitting}
                >
                  Disconnect
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleTestConnection('gong')}
                    className="btn btn-secondary btn-sm"
                    disabled={submitting}
                  >
                    Test Connection
                  </button>
                  <button
                    type="button"
                    onClick={handleImportGongCalls}
                    className="btn btn-primary btn-sm"
                    disabled={submitting}
                  >
                    <Play size={13} /> {submitting ? 'Importing...' : 'Import Calls Now'}
                  </button>
                </div>
              </div>

              {gongImportResult && (
                <div style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                  <strong>Import Summary:</strong> {gongImportResult.importedCount} new calls imported, {gongImportResult.duplicateCount} duplicates skipped (Total found: {gongImportResult.totalFound}).
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL: HUBSPOT CONFIGURATION & SYNC ================= */}
      <Modal
        isOpen={activeModal === 'hubspot'}
        onClose={() => setActiveModal(null)}
        title="HubSpot Sales CRM Integration"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {actionMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: actionMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${actionMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
              }}
            >
              {actionMessage.text}
            </div>
          )}

          {/* Section 1: OAuth Connect Button */}
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Connect via HubSpot OAuth 2.0
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Authorizes DealFlow AI to read deals, sync pipelines, and update hygiene notes using your HubSpot App Client ID and Secret.
            </p>

            <button
              onClick={handleConnectHubspotOAuth}
              className="btn btn-primary"
              style={{ background: '#ff7a59', borderColor: '#ff7a59' }}
              disabled={submitting}
            >
              <ExternalLink size={16} /> Connect with HubSpot
            </button>
          </div>

          {/* Section 2: Sync and Field Mapping (only if connected) */}
          {getIntegrationData('hubspot').connectionStatus === 'connected' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Deal Synchronization & Mapping
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>dealname</span> <ArrowRight size={14} /> <strong>Deal Opportunity Name</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>amount</span> <ArrowRight size={14} /> <strong>Deal Value (USD)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>dealstage</span> <ArrowRight size={14} /> <strong>Stage & Probability</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span>closedate</span> <ArrowRight size={14} /> <strong>Target Close Date</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleDisconnect('hubspot')}
                  className="btn btn-danger btn-sm"
                  disabled={submitting}
                >
                  Disconnect
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleTestConnection('hubspot')}
                    className="btn btn-secondary btn-sm"
                    disabled={submitting}
                  >
                    Test Connection
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncHubspotDeals}
                    className="btn btn-primary btn-sm"
                    disabled={submitting}
                  >
                    <RefreshCw size={13} /> {submitting ? 'Syncing...' : 'Sync Deals Now'}
                  </button>
                </div>
              </div>

              {hubspotSyncResult && (
                <div style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                  <strong>Sync Result:</strong> {hubspotSyncResult.createdCount} new deals imported, {hubspotSyncResult.updatedCount} deals updated.
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL: JIRA CONFIGURATION & TEST TASK ================= */}
      <Modal
        isOpen={activeModal === 'jira'}
        onClose={() => setActiveModal(null)}
        title="Atlassian Jira Cloud Integration"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {actionMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.825rem',
                background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: actionMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${actionMessage.type === 'success' ? 'var(--success-border)' : 'var(--danger-border)'}`,
              }}
            >
              {actionMessage.text}
            </div>
          )}

          {/* Section 1: Atlassian OAuth Initiation */}
          <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Atlassian OAuth 2.0 (3LO)
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Authorizes DealFlow AI to access your Jira Cloud instances, list projects, and create action item tasks.
            </p>

            <button
              onClick={handleConnectJiraOAuth}
              className="btn btn-primary"
              style={{ background: '#0052cc', borderColor: '#0052cc' }}
              disabled={submitting}
            >
              <ExternalLink size={16} /> Connect Atlassian Jira Cloud
            </button>
          </div>

          {/* Section 2: Project Key Configuration & ADF Test */}
          {getIntegrationData('jira').connectionStatus === 'connected' && (
            <form onSubmit={handleSaveJiraConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Target Project & Issue Configuration
              </h4>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Jira Cloud Instance ID (CloudId)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1a2b3c4d-5e6f-..."
                  value={jiraCloudId}
                  onChange={(e) => setJiraCloudId(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    Project Key
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SALES, CRM, TASK"
                    value={jiraProjectKey}
                    onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    Issue Type ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10001 (Task)"
                    value={jiraIssueTypeId}
                    onChange={(e) => setJiraIssueTypeId(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleDisconnect('jira')}
                  className="btn btn-danger btn-sm"
                  disabled={submitting}
                >
                  Disconnect
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleTestJiraTask}
                    className="btn btn-secondary btn-sm"
                    disabled={submitting || !jiraProjectKey}
                    title="Creates a test task using Atlassian Document Format (ADF)"
                  >
                    Create Test Task (ADF)
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                    Save Settings
                  </button>
                </div>
              </div>

              {jiraTestResult && (
                <div style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                  <strong>Task Created:</strong> Issue Key <strong>{jiraTestResult.issueKey}</strong> (ID: {jiraTestResult.issueId})
                </div>
              )}
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default IntegrationsPage;
