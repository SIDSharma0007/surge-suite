import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { 
  LayoutGrid, 
  Table, 
  FileText, 
  FolderOpen, 
  Settings, 
  LogOut, 
  Plus, 
  Menu, 
  FolderPlus,
  ChevronRight,
  Pin,
  Clock,
  Zap,
  Database
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Workspaces');

  // Real-time states representing an empty workspace suite
  const [workspaces, setWorkspaces] = useState([]);
  const [pinnedFiles, setPinnedFiles] = useState([]);

  const { currentUser, logout } = useAuth();

  const firstName = currentUser?.name 
    ? currentUser.name.split(' ')[0] 
    : (localStorage.getItem('firstName') || 'Guest');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get current hour to render greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={styles.container}>
      {/* Sidebar Navigation */}
      <aside style={{
        ...styles.sidebar,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        left: sidebarOpen ? '0' : '-260px',
      }}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logoBox}>
            <LayoutGrid size={16} style={{ color: 'var(--text-primary)' }} />
            <span style={styles.logoText}>Surge Suite</span>
          </div>
        </div>

        <nav style={styles.sidebarNav}>
          {[
            { name: 'Workspaces', icon: LayoutGrid },
            { name: 'Spreadsheets', icon: Table },
            { name: 'Documents', icon: FileText },
            { name: 'Shared Files', icon: FolderOpen },
            { name: 'Settings', icon: Settings }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.name);
                  setSidebarOpen(false);
                }}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={{
                  ...styles.navItem,
                  background: isActive ? 'var(--bg-hover)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? '600' : '500',
                }}
              >
                <Icon size={15} style={{ marginRight: '10px', opacity: isActive ? 1 : 0.7, transition: 'var(--transition-all)' }} />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={14} style={{ marginRight: '10px', opacity: 0.7 }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={styles.mainContent}>
        {/* Top Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            {/* Mobile Sidebar Hamburger Toggle */}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.hamburgerBtn}>
              <Menu size={18} />
            </button>
            <span style={styles.pageTitleBreadcrumb}>Workspaces / <span style={{ color: 'var(--text-primary)' }}>Overview</span></span>
          </div>

          <div style={styles.headerRight}>
            <ThemeToggle />
            <div style={styles.profileBadge}>{firstName.substring(0, 2).toUpperCase()}</div>
          </div>
        </header>

        {/* Dashboard Panels */}
        <main style={styles.contentBody}>
          {activeTab === 'Workspaces' ? (
            <div style={styles.workspaceWrapper}>
              
              {/* Header block */}
              <header style={styles.greetingHeader}>
                <h1 style={styles.greetingTitle}>{getGreeting()}, {firstName}</h1>
                <p style={styles.greetingSubtitle}>Welcome back to your workspace. Here is a summary of your active tasks.</p>
              </header>

              {/* Workspace Sections Grid */}
              <div style={styles.workspaceGrid}>
                
                {/* Main section: Workspaces and Files */}
                <div style={styles.mainSection}>
                  
                  {/* Pinned Documents Section */}
                  <section style={styles.section}>
                    <div style={styles.sectionHeader}>
                      <Pin size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                      <h3 style={styles.sectionTitle}>Pinned Documents</h3>
                    </div>

                    {pinnedFiles.length > 0 ? (
                      <div style={styles.grid}>
                        {/* Render items */}
                      </div>
                    ) : (
                      <div style={styles.emptyCard}>
                        <Pin size={24} strokeWidth={1.5} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                        <h4 style={styles.emptyTitle}>No pinned documents</h4>
                        <p style={styles.emptyText}>Pin important sheets or files to have them pinned here for quick access.</p>
                      </div>
                    )}
                  </section>

                  {/* Continue Working Section */}
                  <section style={{ ...styles.section, marginTop: '32px' }}>
                    <div style={styles.sectionHeader}>
                      <Clock size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                      <h3 style={styles.sectionTitle}>Continue Working</h3>
                    </div>

                    {workspaces.length > 0 ? (
                      <div style={styles.tableWrapper}>
                        {/* Table */}
                      </div>
                    ) : (
                      <div style={styles.emptyCard}>
                        <FolderPlus size={24} strokeWidth={1.5} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                        <h4 style={styles.emptyTitle}>No recent files found</h4>
                        <p style={styles.emptyText}>Create a new workspace document or spreadsheet to begin working.</p>
                      </div>
                    )}
                  </section>

                </div>

                {/* Sidebar section: Quick Actions & Recent Activity */}
                <div style={styles.dashboardRightSidebar}>
                  
                  {/* Quick Actions */}
                  <div style={styles.sidebarWidget}>
                    <div style={styles.widgetHeader}>
                      <Zap size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                      <h4 style={styles.widgetTitle}>Quick Actions</h4>
                    </div>
                    <div style={styles.widgetBody}>
                      <button style={styles.actionBtn}>
                        <Plus size={14} style={{ marginRight: '8px' }} />
                        Create New Document
                      </button>
                      <button style={{ ...styles.actionBtn, marginTop: '8px' }}>
                        <Table size={14} style={{ marginRight: '8px' }} />
                        Create New Spreadsheet
                      </button>
                    </div>
                  </div>

                  {/* Storage Details */}
                  <div style={{ ...styles.sidebarWidget, marginTop: '24px' }}>
                    <div style={styles.widgetHeader}>
                      <Database size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                      <h4 style={styles.widgetTitle}>Storage Quota</h4>
                    </div>
                    <div style={styles.widgetBody}>
                      <div style={styles.quotaInfo}>
                        <span style={styles.quotaText}>0 KB of 1 GB used</span>
                        <span style={styles.quotaPercentage}>0%</span>
                      </div>
                      <div style={styles.progressBarBg}>
                        <div style={styles.progressBarActive} />
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          ) : (
            <div style={styles.emptyTabPanel}>
              <FolderPlus size={36} strokeWidth={1.25} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h3 style={styles.emptyPanelTitle}>{activeTab} Hub</h3>
              <p style={styles.emptyPanelText}>Create a new document to start editing in this workspace tab.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app-solid)',
    color: 'var(--text-primary)',
    transition: 'background-color var(--dur-normal) var(--ease-apple), color var(--dur-normal) var(--ease-apple)',
    fontFamily: 'var(--font-sans)',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    width: '260px',
    backgroundColor: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    transition: 'transform var(--dur-normal) var(--ease-apple)',
  },
  sidebarHeader: {
    padding: 'var(--space-5)',
    borderBottom: '1px solid var(--border-light)',
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--text-primary)',
  },
  logoText: {
    fontSize: 'var(--text-base)',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  },
  sidebarNav: {
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-sm)',
    transition: 'var(--transition-all)',
    position: 'relative',
  },
  sidebarFooter: {
    padding: '20px 16px',
    borderTop: '1px solid var(--border-light)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-sm)',
    fontWeight: '500',
    color: 'var(--text-muted)',
    transition: 'var(--transition-all)',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    marginLeft: 0,
    transition: 'margin var(--dur-normal) var(--ease-apple)',
  },
  header: {
    height: '64px',
    borderBottom: '1px solid var(--border-light)',
    backgroundColor: 'var(--bg-header)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 var(--space-5)',
    position: 'sticky',
    top: 0,
    zIndex: 90,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  hamburgerBtn: {
    display: 'none',
  },
  pageTitleBreadcrumb: {
    fontSize: 'var(--text-xs)',
    fontWeight: '500',
    color: 'var(--text-muted)',
    letterSpacing: '-0.1px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  createBtn: {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--text-primary)',
    color: 'var(--bg-card)',
    border: 'none',
    padding: '7px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
    boxShadow: 'var(--shadow-sm)',
  },
  profileBadge: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--text-primary)',
    color: 'var(--bg-app-solid)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--text-xs)',
    fontWeight: '700',
  },
  contentBody: {
    padding: 'var(--space-6) var(--space-5)',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    flex: 1,
    animation: 'fadeIn var(--dur-normal) var(--ease-apple)',
  },
  workspaceWrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  greetingHeader: {
    marginBottom: 'var(--space-6)',
  },
  greetingTitle: {
    fontSize: 'var(--text-2xl)',
    fontWeight: '800',
    letterSpacing: '-1.2px',
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-1)',
  },
  greetingSubtitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  },
  workspaceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: '32px',
    alignItems: 'start',
    width: '100%',
  },
  mainSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    width: '100%',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 'var(--space-3)',
  },
  sectionTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    letterSpacing: '-0.2px',
  },
  emptyCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px var(--space-5)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    textAlign: 'center',
    boxShadow: 'var(--shadow-sm)',
    transition: 'var(--transition-all)',
  },
  emptyTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: '700',
    marginBottom: '4px',
    color: 'var(--text-primary)',
  },
  emptyText: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    maxWidth: '280px',
    lineHeight: '1.5',
  },
  dashboardRightSidebar: {
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarWidget: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  },
  widgetHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 'var(--space-3)',
  },
  widgetTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },
  widgetBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    background: 'var(--bg-sidebar)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    transition: 'var(--transition-all)',
    textAlign: 'left',
  },

  quotaInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
    fontWeight: '500',
  },
  progressBarBg: {
    width: '100%',
    height: '4px',
    background: 'var(--bg-sidebar)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
  },
  progressBarActive: {
    width: '0%',
    height: '100%',
    background: 'var(--text-primary)',
  },
  emptyTabPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
    textAlign: 'center',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    animation: 'fadeIn var(--dur-normal) var(--ease-apple)',
  },
  emptyPanelTitle: {
    fontSize: 'var(--text-lg)',
    fontWeight: '700',
    marginBottom: '8px',
  },
  emptyPanelText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
    maxWidth: '300px',
  }
};
