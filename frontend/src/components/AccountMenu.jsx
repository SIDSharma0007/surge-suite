import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  LogOut, 
  Check 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DEMO_ACCOUNTS = [
  {
    key: 'saurav',
    role: 'owner',
    label: 'Saurav',
    subLabel: 'Primary Workspace Owner',
    username: 'Saurav',
    icon: Sparkles,
    color: '#8b5cf6',
  },
  {
    key: 'admin_demo',
    role: 'admin',
    label: 'Admin User',
    subLabel: 'admin_demo • Review & Operations',
    username: 'admin_demo',
    icon: ShieldCheck,
    color: '#3b82f6',
  },
  {
    key: 'member_demo',
    role: 'member',
    label: 'Member User',
    subLabel: 'member_demo • Tasks & Requests',
    username: 'member_demo',
    icon: User,
    color: '#10b981',
  },
  {
    key: 'viewer_demo',
    role: 'viewer',
    label: 'Viewer User',
    subLabel: 'viewer_demo • Read-Only Access',
    username: 'viewer_demo',
    icon: Eye,
    color: '#64748b',
  },
];

export default function AccountMenu({ onAccountSwitched, onLogout }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { currentUser, login, logout } = useAuth();
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const currentDisplayName = currentUser?.name || currentUser?.user_id || 'User';
  const currentUserId = currentUser?.user_id || '';
  const initials = currentDisplayName.substring(0, 2).toUpperCase();

  // Find if current user matches any demo account
  const activeAccount = DEMO_ACCOUNTS.find(
    (acc) =>
      acc.username.toLowerCase() === currentUserId.toLowerCase() ||
      acc.label.toLowerCase() === currentDisplayName.toLowerCase()
  ) || {
    key: 'custom',
    label: currentDisplayName,
    subLabel: `@${currentUserId}`,
    color: 'var(--text-primary)',
    icon: User,
  };

  const handleSwitchAccount = async (account) => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await api.post('/auth/dev-login/', {
        username: account.username,
        role: account.role,
      });

      if (res.data && res.data.user) {
        login(res.data.user);
        setOpen(false);
        if (onAccountSwitched) {
          await onAccountSwitched(res.data.user);
        }
        window.location.reload();
      }
    } catch (err) {
      console.error('Error switching account:', err);
    } finally {
      setSwitching(false);
    }
  };

  const handleUserLogout = async () => {
    try {
      if (onLogout) {
        onLogout();
      } else {
        await logout();
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = '/login';
    }
  };

  return (
    <div style={styles.container} ref={menuRef}>
      {/* Circular Profile Avatar Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          ...styles.avatarBtn,
          borderColor: open ? 'var(--text-primary)' : 'var(--border-medium)',
        }}
        title={`Logged in as ${currentDisplayName} (${currentUserId}) - Click to switch accounts`}
      >
        <span style={styles.avatarText}>{initials}</span>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div style={styles.dropdown}>
          {/* User Profile Header */}
          <div style={styles.profileHeader}>
            <div style={{ ...styles.headerAvatar, backgroundColor: `${activeAccount.color}25`, color: activeAccount.color }}>
              {initials}
            </div>
            <div style={styles.headerInfo}>
              <span style={styles.headerName}>{currentDisplayName}</span>
              <span style={styles.headerUsername}>@{currentUserId || 'authenticated'}</span>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Switch Accounts Section */}
          <div style={styles.sectionTitleRow}>
            <span style={styles.sectionTitle}>Switch Demo Account</span>
          </div>

          <div style={styles.accountList}>
            {DEMO_ACCOUNTS.map((account) => {
              const isSelected =
                account.username.toLowerCase() === currentUserId.toLowerCase() ||
                account.label.toLowerCase() === currentDisplayName.toLowerCase();
              const AccIcon = account.icon;

              return (
                <button
                  key={account.key}
                  type="button"
                  onClick={() => handleSwitchAccount(account)}
                  disabled={switching}
                  style={{
                    ...styles.accountItem,
                    backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                    cursor: switching ? 'wait' : 'pointer',
                  }}
                >
                  <div style={{ ...styles.accountIconBox, backgroundColor: `${account.color}20`, color: account.color }}>
                    <AccIcon size={14} />
                  </div>

                  <div style={styles.accountTextCol}>
                    <div style={styles.accountNameRow}>
                      <span style={{ ...styles.accountName, fontWeight: isSelected ? '700' : '500' }}>
                        {account.label}
                      </span>
                    </div>
                    <span style={styles.accountSub}>{account.subLabel}</span>
                  </div>

                  {isSelected && (
                    <div style={{ ...styles.checkBadge, color: account.color }}>
                      <Check size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={styles.divider} />

          {/* Logout Action */}
          <button
            type="button"
            onClick={handleUserLogout}
            style={styles.logoutBtn}
          >
            <LogOut size={14} style={{ color: 'var(--status-error, #ef4444)' }} />
            <span style={{ color: 'var(--status-error, #ef4444)', fontSize: '13px', fontWeight: '500' }}>
              Log Out
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  avatarBtn: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-hover)',
    border: '2px solid var(--border-medium)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  avatarText: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '0.5px',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '280px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-lg, 12px)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
    padding: '8px',
    zIndex: 1000,
    animation: 'fadeIn 0.15s ease',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 8px 10px 8px',
  },
  headerAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    flexShrink: 0,
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  headerName: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerUsername: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-light)',
    margin: '4px 0',
  },
  sectionTitleRow: {
    padding: '6px 8px 4px 8px',
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  accountList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  accountItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md, 8px)',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'background-color 0.12s ease',
  },
  accountIconBox: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountTextCol: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  accountNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  accountName: {
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  accountSub: {
    fontSize: '10.5px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  checkBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: 'var(--radius-md, 8px)',
    border: 'none',
    backgroundColor: 'transparent',
    width: '100%',
    cursor: 'pointer',
    marginTop: '2px',
    transition: 'background-color 0.12s ease',
  },
};
