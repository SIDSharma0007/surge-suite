import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { X, Plus, AlertCircle, Loader2 } from 'lucide-react';

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { createWorkspace, workspaces } = useWorkspace();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please enter a workspace name.');
      return;
    }

    if (trimmedName.length > 50) {
      setError('Workspace name must be 50 characters or less.');
      return;
    }

    if (workspaces.length >= 5) {
      setError('You have reached the maximum limit of 5 owned workspaces.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createWorkspace(trimmedName);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create workspace. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Create Workspace</h2>
            <p style={styles.subtitle}>Workspaces isolate notes, tools, and member permissions.</p>
          </div>
          <button 
            onClick={onClose} 
            style={styles.closeBtn} 
            aria-label="Close modal"
            disabled={isSubmitting}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="ws-name-input">Workspace Name</label>
            <input
              id="ws-name-input"
              ref={inputRef}
              type="text"
              placeholder="e.g. AI Research Lab, Marketing, Project Alpha"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              maxLength={50}
              disabled={isSubmitting}
              style={styles.input}
            />
            <span style={styles.charCount}>{name.length}/50</span>
          </div>

          {/* Error display */}
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginRight: '8px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div style={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              style={{
                ...styles.submitBtn,
                opacity: isSubmitting || !name.trim() ? 0.6 : 1,
                cursor: isSubmitting || !name.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} style={{ marginRight: '6px' }} />
                  Create Workspace
                </>
              )}
            </button>
          </div>
        </form>
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
    maxWidth: '460px',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 'var(--space-5) var(--space-5) var(--space-3) var(--space-5)',
    borderBottom: '1px solid var(--border-light)',
  },
  title: {
    fontSize: 'var(--text-lg)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
    margin: 0,
  },
  subtitle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
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
  form: {
    padding: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    gap: '6px',
  },
  label: {
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '11px 14px',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'var(--transition-all)',
    boxShadow: 'var(--shadow-sm)',
  },
  charCount: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    alignSelf: 'flex-end',
    marginTop: '2px',
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
    lineHeight: '1.4',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--space-3)',
    marginTop: 'var(--space-2)',
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-secondary)',
    padding: '9px 16px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
  },
  submitBtn: {
    background: 'var(--text-primary)',
    border: '1px solid var(--text-primary)',
    color: 'var(--bg-card)',
    padding: '9px 18px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'var(--transition-all)',
    boxShadow: 'var(--shadow-sm)',
  },
};
