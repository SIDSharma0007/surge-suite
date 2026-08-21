import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import ArchivedWorkspacesModal from './ArchivedWorkspacesModal';
import { 
  ChevronDown, 
  Check, 
  Plus, 
  Layers, 
  ShieldCheck, 
  User, 
  Archive,
  AlertCircle
} from 'lucide-react';

export default function WorkspaceSelector({ onOpenArchived }) {
  const { 
    workspaces, 
    activeWorkspace, 
    activeWorkspaceId, 
    selectWorkspace, 
    isLoading 
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const dropdownRef = useRef(null);


  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (id) => {
    selectWorkspace(id);
    setIsOpen(false);
  };

  const currentName = activeWorkspace?.name || (isLoading ? 'Loading workspace...' : 'Select Workspace');
  const currentRole = activeWorkspace?.role || 'MEMBER';

  return (
    <div style={styles.container} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          ...styles.triggerBtn,
          ...(isOpen ? styles.triggerBtnActive : {})
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div style={styles.triggerLeft}>
          <div style={styles.iconBox}>
            <Layers size={16} />
          </div>
          <div style={styles.textWrap}>
            <span style={styles.workspaceName}>{currentName}</span>
            {activeWorkspace && (
              <span style={styles.roleBadge}>
                {currentRole === 'OWNER' ? (
                  <><ShieldCheck size={10} style={{ marginRight: '3px' }} /> Owner</>
                ) : (
                  <><User size={10} style={{ marginRight: '3px' }} /> Member</>
                )}
              </span>
            )}
          </div>
        </div>
        <ChevronDown 
          size={14} 
          style={{ 
            color: 'var(--text-muted)', 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--dur-fast) var(--ease-apple)'
          }} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={styles.dropdown} role="menu">
          <div style={styles.menuHeader}>
            <span style={styles.sectionLabel}>Workspaces</span>
            <span style={styles.wsCount}>{workspaces.length}/5</span>
          </div>

          <div style={styles.list}>
            {workspaces.length === 0 ? (
              <div style={styles.emptyState}>
                <AlertCircle size={14} style={{ marginRight: '6px' }} />
                <span>No active workspaces</span>
              </div>
            ) : (
              workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => handleSelect(ws.id)}
                    style={{
                      ...styles.menuItem,
                      ...(isSelected ? styles.menuItemSelected : {})
                    }}
                    role="menuitem"
                  >
                    <div style={styles.itemLeft}>
                      <span style={styles.itemName}>{ws.name}</span>
                      <span style={styles.itemRole}>
                        {ws.role === 'OWNER' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                    {isSelected && (
                      <Check size={14} style={{ color: 'var(--text-primary)' }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div style={styles.divider} />

          {/* Action: Create Workspace */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsModalOpen(true);
            }}
            disabled={workspaces.length >= 5}
            style={{
              ...styles.actionItem,
              opacity: workspaces.length >= 5 ? 0.5 : 1,
              cursor: workspaces.length >= 5 ? 'not-allowed' : 'pointer'
            }}
          >
            <Plus size={14} style={{ marginRight: '8px' }} />
            <span>New Workspace</span>
          </button>

          {/* Action: View Archived Workspaces */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsArchivedModalOpen(true);
              if (onOpenArchived) onOpenArchived();
            }}
            style={styles.actionItem}
          >
            <Archive size={14} style={{ marginRight: '8px' }} />
            <span>Archived Workspaces</span>
          </button>
        </div>
      )}

      {/* Modal for creating a new workspace */}
      <CreateWorkspaceModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* Modal for viewing and restoring archived workspaces */}
      <ArchivedWorkspacesModal
        isOpen={isArchivedModalOpen}
        onClose={() => setIsArchivedModalOpen(false)}
      />
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
  },
  triggerBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
    boxShadow: 'var(--shadow-sm)',
    textAlign: 'left',
  },
  triggerBtnActive: {
    borderColor: 'var(--text-primary)',
    background: 'var(--bg-hover)',
  },
  triggerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  iconBox: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-hover)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-primary)',
    flexShrink: 0,
  },
  textWrap: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  workspaceName: {
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '160px',
  },
  roleBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: '1px',
    textTransform: 'capitalize',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    width: '100%',
    minWidth: '240px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 50,
    padding: '6px',
    animation: 'fadeIn var(--dur-fast) var(--ease-apple)',
    overflow: 'hidden',
  },
  menuHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 8px',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  wsCount: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  list: {
    maxHeight: '180px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 8px',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
    textAlign: 'left',
  },
  menuItemSelected: {
    background: 'var(--bg-hover)',
  },
  itemLeft: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  itemName: {
    fontSize: 'var(--text-sm)',
    fontWeight: '500',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '170px',
  },
  itemRole: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  divider: {
    height: '1px',
    background: 'var(--border-light)',
    margin: '6px 0',
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
  },
};
