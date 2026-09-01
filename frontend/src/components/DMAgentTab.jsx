import React, { useState, useEffect, useRef } from 'react';
import { workspaceServices } from '../services/workspaceServices';
import { Send, Trash2, AlertCircle, Bot, User, Loader2, Download, Database, Server, ShieldCheck } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function DMAgentTab({ activeWorkspaceId, workspaces }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);

  const messagesEndRef = useRef(null);

  // Auto-scroll helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Reset conversation and fetch config on workspace change
  useEffect(() => {
    setMessages([]);
    setError(null);
    setInputValue('');
    
    if (activeWorkspaceId) {
      const ws = workspaces.find(w => w.id === activeWorkspaceId);
      if (ws) {
        setConfig({
          name: ws.name,
          ai_provider: ws.ai_provider || 'simulated',
          ai_model: ws.ai_model || 'dev-mock',
          is_real: ws.ai_provider && ws.ai_provider !== 'simulated'
        });
      }
    } else {
      setConfig(null);
    }
  }, [activeWorkspaceId, workspaces]);

  if (!activeWorkspaceId) {
    return (
      <div style={styles.emptyContainer}>
        <Bot size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={styles.emptyTitle}>No Workspace Selected</h3>
        <p style={styles.emptyText}>Please select or create an active workspace first to DM the agent.</p>
      </div>
    );
  }

  const handleDownloadArtifact = (artifact) => {
    if (!artifact || !artifact.content) return;
    const blob = new Blob([artifact.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', artifact.filename || 'workspace-data.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSend = async (e, forceExport = false) => {
    if (e) e.preventDefault();
    const queryText = (inputValue || '').trim();
    if (!queryText && !forceExport) return;
    if (loading) return;

    const userMessage = queryText || (forceExport ? "Export as markdown" : "");
    setInputValue('');
    setError(null);

    // Append user message locally
    const nextMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      // Map history turns to backend expectation
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await workspaceServices.dm(activeWorkspaceId, {
        message: userMessage,
        history: history,
        export: forceExport
      });

      const reply = response.data;
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: reply.message,
          provider: reply.provider,
          model: reply.model,
          mode: reply.mode,
          data_sources: reply.data_sources || [],
          artifact: reply.artifact || null
        }
      ]);
    } catch (err) {
      console.error(err);
      let errMsg = "Unable to reach the selected AI provider. Check your provider configuration.";
      if (err.response?.data?.error) {
        errMsg = err.response.data.error;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getProviderDisplayName = (provider) => {
    const names = {
      simulated: "Simulated",
      gemini: "Google AI Studio / Gemini",
      groq: "Groq",
      nvidia_nim: "NVIDIA NIM",
      openclaw: "OpenClaw",
      opencode: "OpenCode"
    };
    return names[provider] || provider;
  };

  return (
    <div style={styles.chatWrapper}>
      {/* Configuration Header Banner */}
      <header style={styles.chatHeader}>
        <div style={styles.headerInfo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={styles.headerTitle}>DM the Agent</h3>
            <span style={styles.readOnlyBadge}>
              <ShieldCheck size={12} style={{ color: '#0A84FF' }} />
              Workspace data · READ ONLY
            </span>
          </div>
          <p style={styles.headerSubtitle}>
            Workspace: <strong>{config?.name}</strong>
          </p>
        </div>
        <div style={styles.badgeContainer}>
          <span style={styles.badge}>
            {getProviderDisplayName(config?.ai_provider)}
          </span>
          <span style={styles.badge}>
            {config?.ai_model}
          </span>
          <span style={{
            ...styles.badge,
            backgroundColor: config?.is_real ? 'rgba(52, 199, 89, 0.15)' : 'rgba(142, 142, 147, 0.15)',
            color: config?.is_real ? 'var(--status-success)' : 'var(--text-secondary)',
            fontWeight: '600'
          }}>
            {config?.is_real ? 'REAL' : 'SIMULATED'}
          </span>
        </div>
      </header>

      {/* Messages area */}
      <div style={styles.messageList}>
        {messages.length === 0 ? (
          <div style={styles.introContainer}>
            <Bot size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h4 style={styles.introTitle}>Direct Message Workspace Assistant</h4>
            <p style={styles.introText}>
              Ask questions about your grievances, laboratory bookings, certificates, maintenance tickets, or tasks. 
              <br /><br />
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                💡 <em>DM is strictly read-only and safe. To create records or book slots, please use Tasks.</em>
              </span>
            </p>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                ...styles.messageRow,
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              {m.role === 'assistant' && (
                <div style={styles.avatarBot}>
                  <Bot size={16} style={{ color: '#fff' }} />
                </div>
              )}
              
              <div style={m.role === 'user' ? styles.userBubble : styles.botBubble}>
                {m.role === 'user' ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                ) : (
                  <div className="markdown-body-chat" style={styles.markdownWrapper}>
                    <MarkdownRenderer text={m.content} />

                    {/* Data sources pills */}
                    {m.data_sources && m.data_sources.length > 0 && (
                      <div style={styles.sourcesContainer}>
                        <span style={styles.sourcesLabel}>Sources:</span>
                        {m.data_sources.map((src, sIdx) => (
                          <span key={sIdx} style={styles.sourcePill}>
                            {src.type === 'database' ? (
                              <Database size={11} style={{ marginRight: '4px' }} />
                            ) : (
                              <Server size={11} style={{ marginRight: '4px' }} />
                            )}
                            {src.source || src.server || src.tool || 'Workspace DB'}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Export as Markdown action button */}
                    {m.artifact && (
                      <div style={styles.artifactContainer}>
                        <button
                          type="button"
                          onClick={() => handleDownloadArtifact(m.artifact)}
                          style={styles.exportButton}
                        >
                          <Download size={13} style={{ marginRight: '6px' }} />
                          Export as Markdown ({m.artifact.filename})
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {m.role === 'assistant' && (
                  <div style={styles.bubbleMeta}>
                    {getProviderDisplayName(m.provider)} · {m.model} · {m.mode || 'READ_ONLY'}
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div style={styles.avatarUser}>
                  <User size={16} style={{ color: '#fff' }} />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div style={styles.avatarBot}>
              <Bot size={16} style={{ color: '#fff' }} />
            </div>
            <div style={{ ...styles.botBubble, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Agent is querying workspace data...</span>
            </div>
          </div>
        )}

        {error && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} style={{ color: 'var(--status-error)', flexShrink: 0 }} />
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls footer */}
      <footer style={styles.chatFooter}>
        <form onSubmit={handleSend} style={styles.inputForm}>
          <button
            type="button"
            onClick={() => setMessages([])}
            disabled={messages.length === 0 || loading}
            style={{
              ...styles.iconButton,
              opacity: (messages.length === 0 || loading) ? 0.4 : 1
            }}
            title="Clear Conversation"
          >
            <Trash2 size={18} />
          </button>
          
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about workspace records... (e.g., 'Show all my grievances', 'List lab bookings')"
            disabled={loading}
            rows={1}
            style={styles.chatInput}
          />
          
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            style={{
              ...styles.sendButton,
              backgroundColor: (!inputValue.trim() || loading) ? 'var(--border-medium)' : 'var(--text-primary)',
              cursor: (!inputValue.trim() || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            <Send size={15} style={{ color: 'var(--bg-app-solid)' }} />
          </button>
        </form>
      </footer>
    </div>
  );
}

const styles = {
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    padding: '24px'
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    maxWidth: '320px'
  },
  chatWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 120px)',
    backgroundColor: 'var(--bg-card)',
    borderRadius: '12px',
    border: '1px solid var(--border-medium)',
    overflow: 'hidden'
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-app-solid)'
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: '600',
    margin: 0,
    color: 'var(--text-primary)'
  },
  readOnlyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: 'var(--accent-soft, rgba(10, 132, 255, 0.12))',
    color: 'var(--accent, #0A84FF)',
    border: '1px solid var(--accent, rgba(10, 132, 255, 0.25))'
  },
  headerSubtitle: {
    fontSize: '12px',
    margin: 0,
    color: 'var(--text-muted)'
  },
  badgeContainer: {
    display: 'flex',
    gap: '8px'
  },
  badge: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-medium)',
    fontFamily: 'monospace'
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  introContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 'auto',
    maxWidth: '400px',
    textAlign: 'center',
    padding: '40px 20px'
  },
  introTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 8px 0'
  },
  introText: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
    margin: 0
  },
  messageRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    maxWidth: '85%'
  },
  avatarBot: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent, #007AFF)',
    color: 'var(--btn-primary-text, #ffffff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  avatarUser: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-medium)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  userBubble: {
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    borderRadius: '16px 16px 2px 16px',
    padding: '10px 14px',
    fontSize: '14px',
    lineHeight: '1.4',
    border: '1px solid var(--border-medium)',
    wordBreak: 'break-word'
  },
  botBubble: {
    backgroundColor: 'var(--bg-app-solid)',
    color: 'var(--text-primary)',
    borderRadius: '16px 16px 16px 2px',
    padding: '12px 16px',
    fontSize: '14px',
    lineHeight: '1.5',
    border: '1px solid var(--border-medium)',
    width: '100%',
    wordBreak: 'break-word'
  },
  bubbleMeta: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginTop: '6px',
    borderTop: '1px solid var(--border-medium)',
    paddingTop: '4px',
    fontFamily: 'monospace'
  },
  markdownWrapper: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: 'var(--text-primary)'
  },
  sourcesContainer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border-medium)'
  },
  sourcesLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '500'
  },
  sourcePill: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    fontFamily: 'monospace',
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-medium)'
  },
  artifactContainer: {
    marginTop: '10px',
    display: 'flex'
  },
  exportButton: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: '500',
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: 'var(--accent-soft, rgba(10, 132, 255, 0.1))',
    color: 'var(--accent, #0A84FF)',
    border: '1px solid var(--accent-soft, rgba(10, 132, 255, 0.3))',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    border: '1px solid rgba(255, 59, 48, 0.2)',
    borderRadius: '8px',
    padding: '10px 14px',
    margin: '8px 0'
  },
  errorText: {
    fontSize: '13px',
    color: 'var(--status-error)',
    fontWeight: '500'
  },
  chatFooter: {
    padding: '16px 20px',
    borderTop: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-app-solid)'
  },
  inputForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '6px',
    transition: 'background-color 0.2s'
  },
  chatInput: {
    flex: 1,
    border: '1px solid var(--border-medium)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
    resize: 'none',
    fontFamily: 'inherit',
    lineHeight: '1.4',
    maxHeight: '100px'
  },
  sendButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    transition: 'background-color 0.2s'
  }
};

