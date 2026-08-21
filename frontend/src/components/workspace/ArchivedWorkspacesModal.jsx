import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { 
  X, 
  Archive, 
  RotateCcw, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Layers
} from 'lucide-react';

export default function ArchivedWorkspacesModal({ isOpen, onClose }) {
  const { archivedWorkspaces, restoreWorkspace, workspaces } = useWorkspace();
  const [restoringId, setRestoringId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getDaysRemaining = (scheduledDeletionAt) => {
    if (!scheduledDeletionAt) return 30;
    const expiry = new Date(scheduledDeletionAt);
    const now = new Date();
    const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const handleRestore = async (ws) => {
    const ownedActive = workspaces.filter((w) => w.role === 'OWNER').length;
    if (ownedActive >= 5) {
      setError('You already have 5 active owned workspaces. Archive or manage an active workspace first.');
      return;
    }

    setRestoringId(ws.id);
    setError(null);
    setSuccess(null);

    try {
      await restoreWorkspace(ws.id);
      setSuccess(`"${ws.name}" restored successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to restore workspace.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.iconBox}>
              <Archive size={18} />
            </div>
            <div>
              <h2 style={styles.title}>Archived Workspaces</h2>
              <p style={styles.subtitle}>Workspaces in recovery bin (30-day retention before permanent deletion)</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {error && (
            <div style={styles.errorBox}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginRight: '8px' }} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div style={styles.successBox}>
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginRight: '8px' }} />
              <span>{success}</span>
            </div>
          )}

          {archivedWorkspaces.length === 0 ? (
            <div style={styles.emptyState}>
              <Archive size={32} strokeWidth={1.5} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <h4 style={styles.emptyTitle}>No Archived Workspaces</h4>
              <p style={styles.emptySubtitle}>Archived workspaces will be held here safely for 30 days before permanent deletion.</p>
            </div>
          ) : (
            <div style={styles.list}>
              {archivedWorkspaces.map((ws) => {
                const daysLeft = getDaysRemaining(ws.scheduled_deletion_at);
                const isRestoring = restoringId === ws.id;

                return (
                  <div key={ws.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <div style={styles.cardTitleWrap}>
                        <Layers size={16} style={{ color: 'var(--text-muted)' }} />
                        <h4 style={styles.cardTitle}>{ws.name}</h4>
                      </div>
                      <span style={{
                        ...styles.daysBadge,
                        color: daysLeft <= 5 ? 'var(--status-error)' : 'var(--text-secondary)',
                        background: daysLeft <= 5 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-hover)'
                      }}>
                        <Clock size={11} style={{ marginRight: '4px' }} />
                        {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                      </span>
                    </div>

                    <div style={styles.cardMeta}>
                      <span style={styles.metaItem}>
                        Archived: {ws.archived_at ? new Date(ws.archived_at).toLocaleDateString() : 'Recently'}
                      </span>
                      <span style={styles.metaItem}>
                        Deletion deadline: {ws.scheduled_deletion_at ? new Date(ws.scheduled_deletion_at).toLocaleDateString() : 'In 30 days'}
                      </span>
                    </div>

                    <div style={styles.cardFooter}>
                      <button
                        type="button"
                        onClick={() => handleRestore(ws)}
                        disabled={isRestoring}
                        style={styles.restoreBtn}
                      >
                        {isRestoring ? (
                          <>
                            <Loader2 size={13} className="animate-spin" style={{ marginRight: '6px' }} />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <RotateCcw size={13} style={{ marginRight: '6px' }} />
                            Restore Workspace
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.closeModalBtn}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'var(--space-4)',
    animation: 'fadeIn var(--dur-fast) var(--ease-apple)',
  },
  modal: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '520px',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '85vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--border-light)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  iconBox: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-hover)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
  },
  title: {
    fontSize: 'var(--text-base)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    margin: '2px 0 0 0',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--radius-xs)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-all)',
  },
  body: {
    padding: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    overflowY: 'auto',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: 'var(--status-error)',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
  },
  successBox: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    color: 'var(--status-success)',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-7) var(--space-4)',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: '0 0 4px 0',
  },
  emptySubtitle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    maxWidth: '300px',
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  card: {
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    transition: 'var(--transition-all)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0,
  },
  daysBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
  },
  cardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  metaItem: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '4px',
  },
  restoreBtn: {
    background: 'var(--text-primary)',
    border: 'none',
    color: 'var(--bg-card)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'var(--transition-all)',
  },
  footer: {
    padding: 'var(--space-3) var(--space-5)',
    borderTop: '1px solid var(--border-light)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeModalBtn: {
    background: 'transparent',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-secondary)',
    padding: '7px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
