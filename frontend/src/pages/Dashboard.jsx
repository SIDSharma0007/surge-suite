import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import Notes from './Notes.jsx';
import { workspaceServices } from '../services/workspaceServices';
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
  Database,
  AlertCircle,
  Archive
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Workspaces');

  // Real-time states representing workspaces
  const [workspaces, setWorkspaces] = useState([]);
  const [archivedWorkspaces, setArchivedWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return localStorage.getItem('surge_active_workspace_id') || '';
  });
  const [workspaceError, setWorkspaceError] = useState(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [editingWorkspaceId, setEditingWorkspaceId] = useState(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');

  // Membership modal states
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersWorkspace, setMembersWorkspace] = useState(null);
  const [membersList, setMembersList] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  const [pinnedFiles, setPinnedFiles] = useState([]);

  // Helper to compute remaining days in the Trash Bin (max 30 days)
  const getRemainingDays = (deletedAt) => {
    if (!deletedAt) return 30;
    const deletedDate = new Date(deletedAt);
    const expiryDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const diffTime = expiryDate - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Manage frontend-only list of active notes
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('surge_notes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse local notes:", e);
      }
    }
    return [
      {
        id: 'welcome-note',
        title: 'Welcome to Surge Notes',
        body: '<div>This is a premium monochrome notes writing workspace.</div><div>Feel free to format text, add lists, or insert links!</div>',
        isPinned: false,
        color: 'default',
        tags: ['#welcome', '#guide'],
        updatedAt: new Date().toISOString()
      }
    ];
  });

  // Manage frontend-only list of deleted notes (Trash Bin)
  const [deletedNotes, setDeletedNotes] = useState(() => {
    const saved = localStorage.getItem('surge_notes_bin');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse local bin notes:", e);
      }
    }
    return [];
  });

  const [activeNoteId, setActiveNoteId] = useState(null);

  // Sync active notes to localStorage
  const saveNotes = (updatedNotes) => {
    setNotes(updatedNotes);
    localStorage.setItem('surge_notes', JSON.stringify(updatedNotes));
  };

  // Sync bin notes to localStorage
  const saveBinNotes = (updatedBinNotes) => {
    setDeletedNotes(updatedBinNotes);
    localStorage.setItem('surge_notes_bin', JSON.stringify(updatedBinNotes));
  };

  const fetchWorkspaces = async () => {
    try {
      setWorkspaceError(null);
      const res = await workspaceServices.list();
      setWorkspaces(res.data);
      
      const archivedRes = await workspaceServices.listArchived();
      setArchivedWorkspaces(archivedRes.data);
      
      // Auto active workspace selection
      if (res.data.length > 0) {
        const found = res.data.find(w => w.id === activeWorkspaceId);
        if (!found) {
          setActiveWorkspaceId(res.data[0].id);
          localStorage.setItem('surge_active_workspace_id', res.data[0].id);
        }
      } else {
        setActiveWorkspaceId('');
        localStorage.removeItem('surge_active_workspace_id');
      }
    } catch (err) {
      console.error("Failed to fetch workspaces:", err);
      setWorkspaceError("Failed to load workspaces. Please check connection.");
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      setWorkspaceError(null);
      const res = await workspaceServices.create({ name: newWorkspaceName });
      setNewWorkspaceName('');
      await fetchWorkspaces();
      setActiveWorkspaceId(res.data.id);
      localStorage.setItem('surge_active_workspace_id', res.data.id);
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to create workspace.";
      setWorkspaceError(msg);
    }
  };

  const handleStartEdit = (ws) => {
    setEditingWorkspaceId(ws.id);
    setEditingWorkspaceName(ws.name);
  };

  const handleSaveRename = async (id) => {
    if (!editingWorkspaceName.trim()) return;
    try {
      setWorkspaceError(null);
      await workspaceServices.update(id, { name: editingWorkspaceName });
      setEditingWorkspaceId(null);
      await fetchWorkspaces();
    } catch (err) {
      setWorkspaceError(err.response?.data?.error || "Failed to rename workspace.");
    }
  };

  const handleArchiveWorkspace = async (id) => {
    try {
      setWorkspaceError(null);
      await workspaceServices.archive(id);
      await fetchWorkspaces();
    } catch (err) {
      setWorkspaceError(err.response?.data?.error || "Failed to archive workspace.");
    }
  };

  const handleRestoreWorkspace = async (id) => {
    try {
      setWorkspaceError(null);
      await workspaceServices.restore(id);
      await fetchWorkspaces();
    } catch (err) {
      setWorkspaceError(err.response?.data?.error || "Failed to restore workspace.");
    }
  };

  const handleOpenMembers = async (ws) => {
    try {
      setWorkspaceError(null);
      setMembersWorkspace(ws);
      const membersRes = await workspaceServices.listMembers(ws.id);
      setMembersList(membersRes.data);
      const usersRes = await workspaceServices.listAllUsers();
      setAllUsersList(usersRes.data);
      setMembersModalOpen(true);
    } catch (err) {
      setWorkspaceError("Failed to open membership dashboard.");
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserToAdd) return;
    try {
      setWorkspaceError(null);
      await workspaceServices.addMember(membersWorkspace.id, { user_id: selectedUserToAdd });
      setSelectedUserToAdd('');
      // Reload members
      const membersRes = await workspaceServices.listMembers(membersWorkspace.id);
      setMembersList(membersRes.data);
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to add member.";
      setWorkspaceError(msg);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      setWorkspaceError(null);
      await workspaceServices.removeMember(membersWorkspace.id, userId);
      // Reload members
      const membersRes = await workspaceServices.listMembers(membersWorkspace.id);
      setMembersList(membersRes.data);
    } catch (err) {
      setWorkspaceError("Failed to remove member.");
    }
  };

  // Boot-time auto-purge for items older than 30 days
  useEffect(() => {
    const parsed = deletedNotes;
    const pruned = parsed.filter(n => {
      const daysLeft = getRemainingDays(n.deletedAt);
      return daysLeft > 0;
    });
    if (pruned.length !== parsed.length) {
      saveBinNotes(pruned);
    }
  }, []);

  const handleCreateNote = () => {
    const newNote = {
      id: `note-${Date.now()}`,
      title: '',
      body: '',
      isPinned: false,
      color: 'default',
      tags: [],
      updatedAt: new Date().toISOString()
    };
    const updated = [newNote, ...notes];
    saveNotes(updated);
    setActiveNoteId(newNote.id);
    setActiveTab('Notes');
  };

  const handleUpdateNote = (updatedNote) => {
    const updated = notes.map(n => n.id === updatedNote.id ? { ...updatedNote, updatedAt: new Date().toISOString() } : n);
    saveNotes(updated);
  };

  const handleTogglePinNote = (noteId) => {
    const updated = notes.map(n => n.id === noteId ? { ...n, isPinned: !n.isPinned } : n);
    saveNotes(updated);
  };

  // Move note to trash bin (delete action)
  const handleDeleteNote = (noteId) => {
    const noteToDelete = notes.find(n => n.id === noteId);
    if (!noteToDelete) return;

    // Move to bin
    const deletedNote = {
      ...noteToDelete,
      deletedAt: new Date().toISOString()
    };
    const updatedBin = [deletedNote, ...deletedNotes];
    saveBinNotes(updatedBin);

    // Remove from active notes
    const updatedNotes = notes.filter(n => n.id !== noteId);
    saveNotes(updatedNotes);

    // Clear active selection
    if (activeNoteId === noteId) {
      setActiveNoteId(null);
    }
  };

  // Restore note from trash bin
  const handleRestoreNote = (noteId) => {
    const noteToRestore = deletedNotes.find(n => n.id === noteId);
    if (!noteToRestore) return;

    const { deletedAt, ...restoredNote } = noteToRestore;
    restoredNote.updatedAt = new Date().toISOString();

    // Move back to active list
    const updatedNotes = [restoredNote, ...notes];
    saveNotes(updatedNotes);

    // Remove from bin list
    const updatedBin = deletedNotes.filter(n => n.id !== noteId);
    saveBinNotes(updatedBin);
  };

  // Permanently delete a single note
  const handlePermanentlyDeleteNote = (noteId) => {
    const updatedBin = deletedNotes.filter(n => n.id !== noteId);
    saveBinNotes(updatedBin);
  };

  // Empty the entire Trash Bin
  const handleEmptyBin = () => {
    saveBinNotes([]);
  };

  const handleOpenNote = (noteId) => {
    setActiveNoteId(noteId);
    setActiveTab('Notes');
  };

  const getExcerpt = (htmlString) => {
    if (!htmlString) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const text = doc.body.textContent || doc.body.innerText || '';
      return text.length > 80 ? text.substring(0, 80) + '...' : text;
    } catch (e) {
      return '';
    }
  };

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
            { name: 'Notes', icon: FileText },
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
            <span style={styles.pageTitleBreadcrumb}>
              {activeTab === 'Notes' ? 'Notes' : activeTab} / <span style={{ color: 'var(--text-primary)' }}>Overview</span>
            </span>
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
                <h1 style={styles.greetingTitle}>Workspaces</h1>
                <p style={styles.greetingSubtitle}>Manage and organize your team workspaces and access limits.</p>
              </header>

              {workspaceError && (
                <div style={styles.errorAlert}>
                  <AlertCircle size={15} style={{ marginRight: '8px', flexShrink: 0 }} />
                  {workspaceError}
                </div>
              )}

              {/* Create Workspace Panel */}
              <section style={styles.section}>
                <div style={styles.sectionHeader}>
                  <FolderPlus size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                  <h3 style={styles.sectionTitle}>Create New Workspace</h3>
                </div>
                <form onSubmit={handleCreateWorkspace} style={styles.createForm}>
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Enter workspace name"
                    style={styles.textInput}
                    disabled={workspaces.filter(w => w.owner.username === username).length >= 5}
                  />
                  <button 
                    type="submit" 
                    style={styles.actionBtn}
                    disabled={workspaces.filter(w => w.owner.username === username).length >= 5}
                  >
                    <Plus size={14} style={{ marginRight: '6px' }} />
                    Create
                  </button>
                </form>
                {workspaces.filter(w => w.owner.username === username).length >= 5 && (
                  <p style={{ color: 'var(--status-error)', fontSize: '12px', marginTop: '8px' }}>
                    * You have reached the maximum limit of 5 owned workspaces (including archived ones).
                  </p>
                )}
              </section>

              {/* Active/Accessible Workspaces Section */}
              <section style={{ ...styles.section, marginTop: '32px' }}>
                <div style={styles.sectionHeader}>
                  <LayoutGrid size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                  <h3 style={styles.sectionTitle}>Active Workspaces</h3>
                </div>

                {workspaces.length > 0 ? (
                  <div style={styles.workspaceGrid}>
                    {workspaces.map(ws => {
                      const isEditing = editingWorkspaceId === ws.id;
                      const isOwner = ws.owner.username === username;
                      const isActive = activeWorkspaceId === ws.id;
                      
                      return (
                        <div 
                          key={ws.id} 
                          style={{
                            ...styles.workspaceCard,
                            border: isActive ? '1px solid var(--text-primary)' : '1px solid var(--border-medium)'
                          }}
                        >
                          <div style={styles.workspaceCardHeader}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                <input
                                  type="text"
                                  value={editingWorkspaceName}
                                  onChange={(e) => setEditingWorkspaceName(e.target.value)}
                                  style={{ ...styles.textInput, padding: '4px 8px' }}
                                />
                                <button onClick={() => handleSaveRename(ws.id)} style={{ ...styles.actionBtn, padding: '4px 10px' }}>Save</button>
                                <button onClick={() => setEditingWorkspaceId(null)} style={{ ...styles.actionBtn, background: 'var(--bg-card)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', padding: '4px 10px' }}>Cancel</button>
                              </div>
                            ) : (
                              <>
                                <h4 style={styles.workspaceCardTitle}>{ws.name}</h4>
                                {isActive && <span style={styles.activeLabel}>Active</span>}
                              </>
                            )}
                          </div>
                          
                          <div style={styles.workspaceMeta}>
                            <p style={styles.metaText}><strong>Owner:</strong> {ws.owner.first_name || ws.owner.username}</p>
                            <p style={styles.metaText}><strong>Your Role:</strong> {ws.role}</p>
                          </div>

                          <div style={styles.workspaceActions}>
                            {!isActive && (
                              <button 
                                onClick={() => {
                                  setActiveWorkspaceId(ws.id);
                                  localStorage.setItem('surge_active_workspace_id', ws.id);
                                }} 
                                style={styles.selectBtn}
                              >
                                Select Workspace
                              </button>
                            )}
                            {isOwner && !isEditing && (
                              <>
                                <button onClick={() => handleStartEdit(ws)} style={styles.iconBtn} title="Rename Workspace">
                                  Rename
                                </button>
                                <button onClick={() => handleOpenMembers(ws)} style={styles.iconBtn} title="Manage Members">
                                  Members
                                </button>
                                <button onClick={() => handleArchiveWorkspace(ws.id)} style={{ ...styles.iconBtn, color: 'var(--status-error)' }} title="Archive Workspace">
                                  Archive
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={styles.emptyText}>No active workspaces found. Create one above to get started.</p>
                )}
              </section>

              {/* Archived Workspaces Section */}
              {archivedWorkspaces.length > 0 && (
                <section style={{ ...styles.section, marginTop: '32px' }}>
                  <div style={styles.sectionHeader}>
                    <Archive size={14} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
                    <h3 style={styles.sectionTitle}>Archived Workspaces</h3>
                  </div>
                  <div style={styles.workspaceGrid}>
                    {archivedWorkspaces.map(ws => (
                      <div key={ws.id} style={{ ...styles.workspaceCard, opacity: 0.7, background: 'rgba(0,0,0,0.02)' }}>
                        <div style={styles.workspaceCardHeader}>
                          <h4 style={styles.workspaceCardTitle}>{ws.name}</h4>
                          <span style={{ ...styles.activeLabel, background: 'var(--border-medium)', color: 'var(--text-secondary)' }}>Archived</span>
                        </div>
                        <div style={styles.workspaceMeta}>
                          <p style={styles.metaText}>Archived on: {new Date(ws.archived_at).toLocaleDateString()}</p>
                          <p style={styles.metaText}>Permanent deletion: {new Date(ws.scheduled_deletion_at).toLocaleDateString()}</p>
                        </div>
                        <div style={styles.workspaceActions}>
                          <button onClick={() => handleRestoreWorkspace(ws.id)} style={styles.selectBtn}>
                            Restore Workspace
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Members Management Modal */}
              {membersModalOpen && membersWorkspace && (
                <div style={styles.modalOverlay}>
                  <div style={styles.modalContent}>
                    <h3 style={styles.modalTitle}>Manage Members for "{membersWorkspace.name}"</h3>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Add New Member</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          value={selectedUserToAdd}
                          onChange={(e) => setSelectedUserToAdd(e.target.value)}
                          style={styles.selectInput}
                        >
                          <option value="">Select a user...</option>
                          {allUsersList.map(u => (
                            <option key={u.id} value={u.id}>{u.first_name || u.username}</option>
                          ))}
                        </select>
                        <button onClick={handleAddMember} style={styles.actionBtn}>Add</button>
                      </div>
                    </div>

                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>Current Members</label>
                    <div style={styles.membersList}>
                      {membersList.length > 0 ? (
                        membersList.map(mem => (
                          <div key={mem.id} style={styles.memberRow}>
                            <span>{mem.user.first_name || mem.user.username} ({mem.role})</span>
                            <button onClick={() => handleRemoveMember(mem.user.id)} style={styles.removeBtn}>Remove</button>
                          </div>
                        ))
                      ) : (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No members added yet.</p>
                      )}
                    </div>

                    <button 
                      onClick={() => setMembersModalOpen(false)} 
                      style={{ ...styles.actionBtn, width: '100%', marginTop: '20px', background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
                    >
                      Close Dashboard
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : activeTab === 'Notes' ? (
            <Notes 
              notes={notes}
              deletedNotes={deletedNotes}
              activeNoteId={activeNoteId}
              setActiveNoteId={setActiveNoteId}
              onNewNote={handleCreateNote}
              onUpdateNote={handleUpdateNote}
              onTogglePin={handleTogglePinNote}
              onDeleteNote={handleDeleteNote}
              onRestoreNote={handleRestoreNote}
              onPermanentlyDeleteNote={handlePermanentlyDeleteNote}
              onEmptyBin={handleEmptyBin}
            />
          ) : (
            <div style={styles.emptyTabPanel}>
              <FolderPlus size={36} strokeWidth={1.25} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h3 style={styles.emptyPanelTitle}>{activeTab} Hub</h3>
              <p style={styles.emptyPanelText}>Create a new workspace item to start editing in this tab.</p>
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
  },
  notesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  noteCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: '120px',
  },
  noteCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  noteCardTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  noteCardExcerpt: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: '1.4',
    flex: 1,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  noteCardDate: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  recentNotesList: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  recentNoteRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-light)',
    gap: '16px',
  },
  recentNoteLeft: {
    display: 'flex',
    alignItems: 'center',
    width: '200px',
    flexShrink: 0,
  },
  recentNoteTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recentNoteExcerpt: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recentNoteDate: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontWeight: '500',
    width: '80px',
    textAlign: 'right',
    flexShrink: 0,
  },
  createForm: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    maxWidth: '500px',
    marginBottom: '8px',
  },
  textInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-medium)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    outline: 'none',
  },
  workspaceCard: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    position: 'relative',
    transition: 'var(--transition-all)',
  },
  workspaceCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  workspaceCardTitle: {
    fontSize: 'var(--text-md)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  activeLabel: {
    fontSize: '10px',
    fontWeight: '700',
    background: 'var(--text-primary)',
    color: 'var(--bg-card)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    textTransform: 'uppercase',
  },
  workspaceMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metaText: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  workspaceActions: {
    display: 'flex',
    gap: '8px',
    marginTop: 'auto',
    flexWrap: 'wrap',
  },
  selectBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--text-primary)',
    color: 'var(--bg-card)',
    border: 'none',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
  },
  iconBtn: {
    padding: '5px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-xs)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-all)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-medium)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalTitle: {
    fontSize: 'var(--text-md)',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  selectInput: {
    flex: 1,
    padding: '8px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-medium)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    outline: 'none',
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  memberRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'var(--bg-hover)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--status-error)',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '11px',
  }
};
