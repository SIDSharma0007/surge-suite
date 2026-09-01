import React, { useState } from 'react';
import { ShieldCheck, Shield, User, Eye, ChevronDown, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const PROFILES = [
  {
    role: 'owner',
    label: 'Workspace Owner',
    username: 'Saurav',
    badge: 'OWNER',
    description: 'Full workspace ownership, settings & escalation control',
    icon: Sparkles,
    color: '#8b5cf6',
  },
  {
    role: 'admin',
    label: 'Admin User',
    username: 'admin_demo',
    badge: 'ADMIN',
    description: 'Review Center access, request approvals & operations',
    icon: ShieldCheck,
    color: '#3b82f6',
  },
  {
    role: 'member',
    label: 'Member User',
    username: 'member_demo',
    badge: 'MEMBER',
    description: 'AI Task execution, ticket submissions & My Requests tracking',
    icon: User,
    color: '#10b981',
  },
  {
    role: 'viewer',
    label: 'Viewer User',
    username: 'viewer_demo',
    badge: 'VIEWER',
    description: 'Read-only access, cannot approve or submit requests',
    icon: Eye,
    color: '#64748b',
  },
];

export default function RoleSwitcher({ currentRole = 'OWNER', onProfileSwitched }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const { currentUser, login } = useAuth();

  const activeProfile =
    PROFILES.find((p) => (p.username.toLowerCase() === (currentUser?.user_id || '').toLowerCase()) || (p.badge === currentRole)) ||
    PROFILES[0];

  const handleSwitch = async (profile) => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await api.post('/auth/dev-login/', { role: profile.role });
      if (res.data && res.data.user) {
        login(res.data.user);
        setOpen(false);
        if (onProfileSwitched) {
          await onProfileSwitched(profile.role, res.data.user);
        }
        // Instant full dashboard refresh to clean all states, counts, and permissions
        window.location.reload();
      }
    } catch (err) {
      console.error('Error switching role:', err);
    } finally {
      setSwitching(false);
    }
  };

  const IconComponent = activeProfile.icon;

  return (
    <div style={styles.container}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        style={{
          ...styles.triggerBtn,
          borderColor: activeProfile.color,
        }}
        title="Switch test account role"
      >
        <span style={{ ...styles.iconBadge, backgroundColor: `${activeProfile.color}20`, color: activeProfile.color }}>
          <IconComponent size={13} />
        </span>
        <span style={styles.roleLabel}>{activeProfile.badge}</span>
        <ChevronDown size={13} style={{ ...styles.chevron, transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <>
          <div style={styles.backdrop} onClick={() => setOpen(false)} />
          <div style={styles.dropdown}>
            <div style={styles.dropdownHeader}>
              <span style={styles.dropdownTitle}>Switch Test Account</span>
              <span style={styles.dropdownSub}>Test role-based visibility & approval flows</span>
            </div>

            <div style={styles.list}>
              {PROFILES.map((profile) => {
                const isSelected = activeProfile.role === profile.role;
                const PIcon = profile.icon;
                return (
                  <button
                    key={profile.role}
                    type="button"
                    onClick={() => handleSwitch(profile)}
                    style={{
                      ...styles.profileItem,
                      backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                    }}
                  >
                    <div style={{ ...styles.itemIcon, backgroundColor: `${profile.color}20`, color: profile.color }}>
                      <PIcon size={15} />
                    </div>
                    <div style={styles.itemContent}>
                      <div style={styles.itemTitleRow}>
                        <span style={styles.itemRole}>{profile.label}</span>
                        <span style={{ ...styles.itemBadge, backgroundColor: `${profile.color}15`, color: profile.color }}>
                          {profile.badge}
                        </span>
                      </div>
                      <span style={styles.itemDesc}>{profile.description}</span>
                    </div>
                    {isSelected && <Check size={14} style={{ color: profile.color, marginLeft: '8px' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
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
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-medium)',
    borderRadius: '16px',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 0.15s ease',
  },
  iconBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
  },
  roleLabel: {
    fontSize: '11px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  chevron: {
    color: 'var(--text-muted)',
    transition: 'transform 0.15s ease',
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '320px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-medium)',
    borderRadius: '12px',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
    zIndex: 999,
    overflow: 'hidden',
    animation: 'fadeIn 0.15s ease',
  },
  dropdownHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-secondary)',
  },
  dropdownTitle: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  dropdownSub: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  list: {
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  profileItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s ease',
  },
  itemIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: '10px',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  itemRole: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  itemBadge: {
    fontSize: '9px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  },
  itemDesc: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--text-muted)',
    lineHeight: '1.3',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
