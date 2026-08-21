import React, { useState, useEffect, useCallback } from 'react';
import { workspaceServices } from '../../services/workspaceServices';
import { 
  X, 
  UserPlus, 
  Trash2, 
  ShieldCheck, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Users
} from 'lucide-react';

export default function WorkspaceMembersModal({ isOpen, onClose, workspace }) {
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const isOwner = workspace?.role === 'OWNER';

  const loadData = useCallback(async () => {
    if (!workspace?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const membersRes = await workspaceServices.listMembers(workspace.id);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);

      if (isOwner) {
        const usersRes = await workspaceServices.listAllUsers();
        setAllUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to load members.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [workspace?.id, isOwner]);

  useEffect(() => {
    if (isOpen && workspace) {
      setError(null);
      setSuccess(null);
      setSelectedUserId('');
      loadData();
    }
  }, [isOpen, workspace, loadData]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !workspace) return null;

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      await workspaceServices.addMember(workspace.id, { user_id: selectedUserId });
      setSelectedUserId('');
      setSuccess('Member added successfully.');
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to add member.';
      setError(msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    const confirmed = window.confirm(`Are you sure you want to remove ${memberName || 'this user'} from the workspace?`);
    if (!confirmed) return;

    setRemovingId(userId);
    setError(null);
    setSuccess(null);

    try {
      await workspaceServices.removeMember(workspace.id, userId);
      setSuccess('Member removed successfully.');
      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to remove member.';
      setError(msg);
    } finally {
      setRemovingId(null);
    }
  };

  // Filter out users already in workspace or the owner
  const eligibleUsers = allUsers.filter(
    (u) => u.id !== workspace.owner?.id && !members.some((m) => m.user.id === u.id)
  );

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleWrap}>
            <div style={styles.headerIcon}>
              <Users size={18} />
            </div>
            <div>
              <h2 style={styles.title}>Workspace Members</h2>
              <p style={styles.subtitle}>{workspace.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div style={styles.body}>
          {/* Notifications */}
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginRight: '8px' }} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div style={styles.successBox}>
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginRight: '8px' }} />
              <span>{success}</span>
            </div>
          )}

          {/* Add Member Form (Owner only) */}
          {isOwner && (
            <section style={styles.addSection}>
              <span style={styles.sectionLabel}>Add New Member</span>
              <form onSubmit={handleAddMember} style={styles.addForm}>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={styles.selectInput}
                  disabled={isAdding || eligibleUsers.length === 0}
                >
                  <option value="">
                    {eligibleUsers.length > 0 ? 'Select a user to add...' : 'No additional users available'}
                  </option>
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name ? `${u.first_name} (@${u.username})` : u.username}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isAdding || !selectedUserId}
                  style={{
                    ...styles.addBtn,
                    opacity: isAdding || !selectedUserId ? 0.6 : 1,
                    cursor: isAdding || !selectedUserId ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isAdding ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={15} style={{ marginRight: '6px' }} />
                      Add
                    </>
                  )}
                </button>
              </form>
            </section>
          )}

          {/* Members List */}
          <section style={styles.listSection}>
            <div style={styles.listHeader}>
              <span style={styles.sectionLabel}>Active Team Members</span>
              <span style={styles.memberCountBadge}>{members.length + 1} total</span>
            </div>

            {isLoading ? (
              <div style={styles.loadingWrap}>
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Loading member directory...</span>
              </div>
            ) : (
              <div style={styles.membersList}>
                {/* Workspace Owner Row */}
                <div style={styles.memberRow}>
                  <div style={styles.memberInfo}>
                    <div style={{ ...styles.avatar, background: 'var(--text-primary)', color: 'var(--bg-card)' }}>
                      {(workspace.owner?.first_name || workspace.owner?.username || 'O')[0].toUpperCase()}
                    </div>
                    <div style={styles.memberMeta}>
                      <span style={styles.memberName}>
                        {workspace.owner?.first_name || workspace.owner?.username}
                        <span style={styles.youTag}>(Workspace Owner)</span>
                      </span>
                      <span style={styles.memberSub}>@{workspace.owner?.username}</span>
                    </div>
                  </div>
                  <span style={styles.ownerBadge}>
                    <ShieldCheck size={11} style={{ marginRight: '4px' }} /> Owner
                  </span>
                </div>

                {/* Additional Members */}
                {members.map((m) => {
                  const isBeingRemoved = removingId === m.user.id;
                  return (
                    <div key={m.id} style={styles.memberRow}>
                      <div style={styles.memberInfo}>
                        <div style={styles.avatar}>
                          {(m.user.first_name || m.user.username || 'M')[0].toUpperCase()}
                        </div>
                        <div style={styles.memberMeta}>
                          <span style={styles.memberName}>{m.user.first_name || m.user.username}</span>
                          <span style={styles.memberSub}>@{m.user.username}</span>
                        </div>
                      </div>

                      <div style={styles.memberActions}>
                        <span style={styles.memberBadge}>
                          <User size={11} style={{ marginRight: '4px' }} /> Member
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.user.id, m.user.first_name || m.user.username)}
                            disabled={isBeingRemoved}
                            style={styles.removeBtn}
                            title="Remove from workspace"
                          >
                            {isBeingRemoved ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button type="button" onClick={onClose} style={styles.closeModalBtn}>
            Close
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
    maxHeight: '90vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--border-light)',
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIcon: {
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
  addSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'var(--bg-hover)',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  addForm: {
    display: 'flex',
    gap: '8px',
  },
  selectInput: {
    flex: 1,
    background: 'var(--bg-input)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  addBtn: {
    background: 'var(--text-primary)',
    border: 'none',
    color: 'var(--bg-card)',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-all)',
    minWidth: '70px',
  },
  listSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCountBadge: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-6)',
    gap: '8px',
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    transition: 'var(--transition-all)',
  },
  memberInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--border-medium)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
  },
  memberMeta: {
    display: 'flex',
    flexDirection: 'column',
  },
  memberName: {
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  youTag: {
    fontSize: '10px',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  memberSub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  memberActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ownerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: '600',
    background: 'var(--text-primary)',
    color: 'var(--bg-card)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
  },
  memberBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: '500',
    background: 'var(--border-medium)',
    color: 'var(--text-secondary)',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--status-error)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--radius-xs)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-all)',
    opacity: 0.75,
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
