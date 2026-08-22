import React, { useState, useEffect } from 'react';
import { settingsServices } from '../services/settingsServices';
import { workspaceServices } from '../services/workspaceServices';
import { Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, Cpu, Sliders } from 'lucide-react';

export default function SettingsTab({ activeWorkspaceId, onWorkspaceUpdated }) {
  // Provider registry state from backend
  const [registry, setRegistry] = useState({});
  
  // Workspace settings state
  const [workspaceSettingsLoading, setWorkspaceSettingsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('simulated');
  const [selectedModel, setSelectedModel] = useState('dev-mock');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);

  // Credentials configurations state
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Feedback alerts
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Input states map: provider -> string
  const [inputs, setInputs] = useState({});
  // Visibility states map: provider -> boolean
  const [visibility, setVisibility] = useState({});
  // Individual loading status map: provider -> boolean
  const [actionLoading, setActionLoading] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch backend AI providers and models registry
      const registryRes = await workspaceServices.listAIProviders();
      setRegistry(registryRes.data);

      // 2. Fetch credentials configurations
      const credsRes = await settingsServices.listProviders();
      setProviders(credsRes.data);
      
      const initialInputs = {};
      const initialVisibility = {};
      credsRes.data.forEach(p => {
        initialInputs[p.provider] = '';
        initialVisibility[p.provider] = false;
      });
      setInputs(initialInputs);
      setVisibility(initialVisibility);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load settings data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaceSettings = async () => {
    if (!activeWorkspaceId) return;
    setWorkspaceSettingsLoading(true);
    try {
      const res = await workspaceServices.getSettings(activeWorkspaceId);
      setSelectedProvider(res.data.ai_provider || 'simulated');
      setSelectedModel(res.data.ai_model || 'dev-mock');
    } catch (err) {
      console.error(err);
      setError("Failed to load workspace settings.");
    } finally {
      setWorkspaceSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchWorkspaceSettings();
  }, [activeWorkspaceId]);

  // Handle provider selection change and automatically pick the first model of the new provider
  const handleProviderChange = (prov) => {
    setSelectedProvider(prov);
    const models = registry[prov]?.models || [];
    setSelectedModel(models[0] || '');
  };

  const handleSaveWorkspaceSettings = async () => {
    if (!activeWorkspaceId) return;
    setWorkspaceSaving(true);
    try {
      await workspaceServices.updateSettings(activeWorkspaceId, {
        ai_provider: selectedProvider,
        ai_model: selectedModel
      });
      showNotification("Workspace settings saved successfully.");
      if (onWorkspaceUpdated) {
        await onWorkspaceUpdated();
      }
    } catch (err) {
      console.error(err);
      showNotification("Failed to save workspace settings.", true);
    } finally {
      setWorkspaceSaving(false);
    }
  };

  const handleInputChange = (provider, value) => {
    setInputs(prev => ({ ...prev, [provider]: value }));
  };

  const toggleVisibility = (provider) => {
    setVisibility(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setError(null);
    }
    setTimeout(() => {
      setError(null);
      setSuccessMsg(null);
    }, 4000);
  };

  const handleSaveKey = async (provider) => {
    const key = inputs[provider];
    if (!key) {
      showNotification("API Key cannot be empty.", true);
      return;
    }

    setActionLoading(prev => ({ ...prev, [provider]: true }));
    try {
      await settingsServices.saveProviderKey(provider, key);
      showNotification(`API Key saved successfully.`);
      // Refresh credentials configurations list
      const credsRes = await settingsServices.listProviders();
      setProviders(credsRes.data);
      setInputs(prev => ({ ...prev, [provider]: '' }));
    } catch (err) {
      console.error(err);
      showNotification(`Failed to save key.`, true);
    } finally {
      setActionLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleRemoveKey = async (provider) => {
    if (!window.confirm(`Are you sure you want to remove this credential?`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [provider]: true }));
    try {
      await settingsServices.deleteProviderKey(provider);
      showNotification(`API Key removed successfully.`);
      const credsRes = await settingsServices.listProviders();
      setProviders(credsRes.data);
    } catch (err) {
      console.error(err);
      showNotification(`Failed to remove key.`, true);
    } finally {
      setActionLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const getProviderDescription = (providerId) => {
    const descs = {
      gemini: "Power agentic workflows using Google's Gemini models.",
      groq: "Ultra-fast inference gateway compatible with Llama and Mixtral.",
      nvidia_nim: "Accelerated model execution from NVIDIA's NIM catalog.",
      openclaw: "Local OpenAI-compatible API gateway and MCP router.",
      opencode: "Dedicated code assistance gateway and coder runtimes.",
      simulated: "Run in offline, mock-only simulation mode for tests."
    };
    return descs[providerId] || "";
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Fetching AI settings details...</p>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>AI Settings</h1>
        <p style={styles.subtitle}>
          Configure your workspace default model execution choices and manage provider credentials.
        </p>
      </header>

      {/* Notifications */}
      {successMsg && (
        <div style={{ ...styles.alert, ...styles.alertSuccess }}>
          <CheckCircle size={16} style={{ marginRight: '8px' }} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div style={{ ...styles.alert, ...styles.alertError }}>
          <AlertCircle size={16} style={{ marginRight: '8px' }} />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Workspace Settings */}
      <section style={styles.sectionBlock}>
        <div style={styles.sectionHeaderLine}>
          <Sliders size={18} style={{ marginRight: '8px', color: 'var(--text-secondary)' }} />
          <h2 style={styles.sectionBlockTitle}>Workspace Settings</h2>
        </div>
        <p style={styles.sectionBlockSubtitle}>
          Controls which AI provider and model this specific workspace uses.
        </p>

        {!activeWorkspaceId ? (
          <div style={styles.noActiveWorkspaceBox}>
            <AlertCircle size={18} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
            <span>Select or create a workspace first to configure its model execution settings.</span>
          </div>
        ) : workspaceSettingsLoading ? (
          <p style={styles.loadingText}>Loading workspace AI configuration...</p>
        ) : (
          <div style={styles.workspaceConfigForm}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>AI Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  style={styles.selectDropdown}
                  disabled={workspaceSaving}
                >
                  {Object.keys(registry).map(provId => (
                    <option key={provId} value={provId}>
                      {registry[provId]?.display_name || provId}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>AI Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={styles.selectDropdown}
                  disabled={workspaceSaving}
                >
                  {(registry[selectedProvider]?.models || []).map(modelId => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveWorkspaceSettings}
              style={{ ...styles.btn, ...styles.btnSave, marginTop: '8px', alignSelf: 'flex-start' }}
              disabled={workspaceSaving}
            >
              <Save size={14} style={{ marginRight: '6px' }} />
              {workspaceSaving ? 'Saving...' : 'Save Workspace Settings'}
            </button>
          </div>
        )}
      </section>

      {/* Section 2: AI Provider Credentials */}
      <section style={styles.sectionBlock}>
        <div style={styles.sectionHeaderLine}>
          <Cpu size={18} style={{ marginRight: '8px', color: 'var(--text-secondary)' }} />
          <h2 style={styles.sectionBlockTitle}>AI Provider Credentials</h2>
        </div>
        <p style={styles.sectionBlockSubtitle}>
          Configure your personal API credentials. Keys are encrypted symmetrically and never leaked.
        </p>

        <div style={styles.grid}>
          {providers.map(p => {
            const isConfigured = p.configured;
            const isActionLoading = actionLoading[p.provider];
            
            return (
              <div key={p.provider} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.headerTitleWrap}>
                    <div style={styles.iconCircle}>
                      <Cpu size={16} style={{ color: 'var(--text-primary)' }} />
                    </div>
                    <div>
                      <h3 style={styles.providerName}>{registry[p.provider]?.display_name || p.provider}</h3>
                      <p style={styles.providerDesc}>{getProviderDescription(p.provider)}</p>
                    </div>
                  </div>
                  
                  <span style={{
                    ...styles.badge,
                    backgroundColor: isConfigured ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: isConfigured ? 'var(--status-success, #22c55e)' : 'var(--status-error, #ef4444)',
                    border: isConfigured ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                  }}>
                    {isConfigured ? 'Configured' : 'Not configured'}
                  </span>
                </div>

                <div style={styles.cardContent}>
                  {isConfigured && p.masked_key && (
                    <div style={styles.maskedKeySection}>
                      <span style={styles.maskedLabel}>Active Key:</span>
                      <code style={styles.maskedValue}>{p.masked_key}</code>
                    </div>
                  )}

                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>
                      {isConfigured ? 'Replace API Key' : 'Enter API Key'}
                    </label>
                    <div style={styles.inputWrapper}>
                      <input
                        type={visibility[p.provider] ? 'text' : 'password'}
                        value={inputs[p.provider] || ''}
                        onChange={(e) => handleInputChange(p.provider, e.target.value)}
                        placeholder={isConfigured ? 'Enter new key to replace existing' : 'Enter API Key'}
                        style={styles.keyInput}
                        disabled={isActionLoading}
                      />
                      <button
                        type="button"
                        onClick={() => toggleVisibility(p.provider)}
                        style={styles.visibleBtn}
                        disabled={isActionLoading}
                      >
                        {visibility[p.provider] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div style={styles.actionsWrap}>
                    <button
                      type="button"
                      onClick={() => handleSaveKey(p.provider)}
                      style={{ ...styles.btn, ...styles.btnSave }}
                      disabled={isActionLoading || !inputs[p.provider]}
                    >
                      <Save size={14} style={{ marginRight: '6px' }} />
                      {isConfigured ? 'Update Key' : 'Save Key'}
                    </button>

                    {isConfigured && (
                      <button
                        type="button"
                        onClick={() => handleRemoveKey(p.provider)}
                        style={{ ...styles.btn, ...styles.btnRemove }}
                        disabled={isActionLoading}
                      >
                        <Trash2 size={14} style={{ marginRight: '6px' }} />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const styles = {
  wrapper: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    animation: 'fadeIn var(--dur-normal) var(--ease-apple)',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.75px',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border-light)',
    borderTop: '3px solid var(--text-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-sm)',
  },
  sectionBlock: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    marginBottom: '32px',
    boxShadow: 'var(--shadow-sm)',
  },
  sectionHeaderLine: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  sectionBlockTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  sectionBlockSubtitle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
  },
  noActiveWorkspaceBox: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-xs)',
  },
  workspaceConfigForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formRow: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '240px',
    flex: '1',
  },
  formLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  selectDropdown: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    outline: 'none',
    cursor: 'pointer',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
    transition: 'var(--transition-all)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    gap: '16px',
  },
  headerTitleWrap: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  iconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'var(--border-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  providerName: {
    fontSize: 'var(--text-sm)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  providerDesc: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
  },
  badge: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  maskedKeySection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--border-light)',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    width: 'fit-content',
  },
  maskedLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  maskedValue: {
    fontFamily: 'monospace',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-primary)',
    letterSpacing: '1px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxWidth: '480px',
  },
  inputLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  keyInput: {
    width: '100%',
    padding: '10px 40px 10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    transition: 'var(--transition-all)',
  },
  visibleBtn: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  actionsWrap: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
    border: '1px solid transparent',
  },
  btnSave: {
    backgroundColor: 'var(--text-primary)',
    color: 'var(--bg-card)',
    opacity: 0.9,
    ':hover': {
      opacity: 1,
    },
    ':disabled': {
      backgroundColor: 'var(--border-medium)',
      color: 'var(--text-muted)',
      cursor: 'not-allowed',
    }
  },
  btnRemove: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: 'var(--status-error, #ef4444)',
    ':hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.05)',
      border: '1px solid rgba(239, 68, 68, 0.4)',
    }
  },
  alert: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-xs)',
    marginBottom: '24px',
    lineHeight: '1.5',
  },
  alertSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid rgba(34, 197, 94, 0.15)',
    color: 'var(--status-success, #22c55e)',
  },
  alertError: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: 'var(--status-error, #ef4444)',
  }
};
