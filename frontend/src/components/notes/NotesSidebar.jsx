import React, { useState } from 'react';
import { 
  Search, 
  Grid, 
  List, 
  FileText, 
  Trash2, 
  Pin, 
  RotateCcw, 
  Trash, 
  X,
  Tag,
  ChevronDown,
  Lock
} from 'lucide-react';
import { canEditNote, canDeleteNote } from '../../utils/notesPermissions';
import { formatShortName } from '../../utils/formatUser';

const COLORS_MAP = {
  default: 'var(--border-medium)',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#f59e0b',
  green: '#10b981',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6'
};

const renderAuthorBadge = (note, isEditable = true) => {
  const role = note?.author?.role || 'MEMBER';
  const rawUsername = note?.author?.username || note?.author?.displayName || 'Member';
  const shortName = formatShortName(note?.author?.username, note?.author?.displayName);
  
  if (role === 'OWNER') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 6px',
        borderRadius: 'var(--radius-full)',
        fontSize: '10px',
        fontWeight: '600',
        background: 'rgba(168, 85, 247, 0.12)',
        color: '#c084fc',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        whiteSpace: 'nowrap'
      }} title={`Added by Owner: ${rawUsername}${!isEditable ? ' (Protected)' : ''}`}>
        {!isEditable ? '🔒' : '👑'} Owner ({shortName})
      </span>
    );
  }
  if (role === 'ADMIN') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 6px',
        borderRadius: 'var(--radius-full)',
        fontSize: '10px',
        fontWeight: '600',
        background: 'rgba(59, 130, 246, 0.12)',
        color: '#60a5fa',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        whiteSpace: 'nowrap'
      }} title={`Added by Admin: ${rawUsername}${!isEditable ? ' (Protected)' : ''}`}>
        {!isEditable ? '🔒' : '🛡️'} Admin ({shortName})
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      padding: '2px 6px',
      borderRadius: 'var(--radius-full)',
      fontSize: '10px',
      fontWeight: '600',
      background: 'rgba(34, 197, 94, 0.12)',
      color: '#4ade80',
      border: '1px solid rgba(34, 197, 94, 0.25)',
      whiteSpace: 'nowrap'
    }} title={`Added by Member: ${rawUsername}${!isEditable ? ' (Protected)' : ''}`}>
      {!isEditable ? '🔒' : '👤'} Member ({shortName})
    </span>
  );
};

export default function NotesSidebar({
  notes,
  deletedNotes,
  activeNoteId,
  setActiveNoteId,
  onNewNote,
  onRestoreNote,
  onPermanentlyDeleteNote,
  onEmptyBin,
  searchQuery,
  setSearchQuery,
  filterTab,
  setFilterTab,
  selectedTag,
  setSelectedTag,
  viewMode,
  setViewMode,
  currentUser,
  userRole
}) {
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Helper to strip HTML tags for search indexing and card excerpts
  const getPlainText = (htmlString) => {
    if (!htmlString) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      return doc.body.textContent || doc.body.innerText || '';
    } catch (e) {
      return '';
    }
  };

  const getRemainingDays = (deletedAt) => {
    if (!deletedAt) return 30;
    const deletedDate = new Date(deletedAt);
    const expiryDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const diffTime = expiryDate - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Compile all unique tags across all active notes to show in the dropdown
  const allUniqueTags = Array.from(
    new Set(
      notes.flatMap(n => n.tags || []).map(t => t.toLowerCase())
    )
  );

  // Determine current list to filter
  const targetNotes = filterTab === 'all' ? notes : deletedNotes;

  // Filter notes based on Search, Tag filter
  const filteredNotes = targetNotes.filter(note => {
    const plainTextBody = getPlainText(note.body).toLowerCase();
    const matchesSearch = 
      note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plainTextBody.includes(searchQuery.toLowerCase()) ||
      note.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = !selectedTag || note.tags?.some(t => t.toLowerCase() === selectedTag.toLowerCase());

    return matchesSearch && matchesTag;
  });

  // Sort notes: pinned active notes always on top, otherwise sort by last updated date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (filterTab === 'all') {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
    }
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return (
    <div className="notes-sidebar">
      {/* Search Bar */}
      <div className="notes-sidebar-search-container">
        <Search size={14} className="notes-sidebar-search-icon" />
        <input
          type="text"
          placeholder="Search notes, tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="notes-sidebar-search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="notes-sidebar-clear-search-btn">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Tabs & Controls */}
      <div className="notes-sidebar-controls">
        <div className="notes-sidebar-tabs">
          <button 
            className={`notes-sidebar-tab ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => { setFilterTab('all'); setSelectedTag(null); }}
            title="All Notes"
          >
            <FileText size={14} style={{ marginRight: '6px' }} />
            <span>Notes</span>
          </button>
          <button 
            className={`notes-sidebar-tab ${filterTab === 'bin' ? 'active' : ''}`}
            onClick={() => { setFilterTab('bin'); setSelectedTag(null); }}
            title="Trash Bin"
          >
            <Trash2 size={14} style={{ marginRight: '6px' }} />
            <span>Bin</span>
          </button>
        </div>

        <div className="notes-sidebar-layout-toggles">
          <button 
            className={`notes-sidebar-layout-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={14} />
          </button>
          <button 
            className={`notes-sidebar-layout-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <Grid size={14} />
          </button>
        </div>
      </div>

      {/* Tag Filtering Row (Only for active notes) */}
      {filterTab === 'all' && allUniqueTags.length > 0 && (
        <div className="notes-sidebar-tags-row">
          <div 
            className="notes-sidebar-tags-header"
            onClick={() => setShowTagDropdown(!showTagDropdown)}
          >
            <Tag size={12} style={{ marginRight: '6px' }} />
            <span style={{ flex: 1 }}>{selectedTag ? `Filtered: ${selectedTag}` : 'Filter by Tag'}</span>
            <ChevronDown size={12} style={{ transform: showTagDropdown ? 'rotate(180deg)' : 'none', transition: 'var(--transition-all)' }} />
          </div>
          
          {showTagDropdown && (
            <div className="notes-sidebar-tags-dropdown">
              <button 
                onClick={() => { setSelectedTag(null); setShowTagDropdown(false); }} 
                className={`tag-dropdown-item ${!selectedTag ? 'active' : ''}`}
              >
                Clear Filters
              </button>
              {allUniqueTags.map(tag => (
                <button 
                  key={tag}
                  onClick={() => { setSelectedTag(tag); setShowTagDropdown(false); }}
                  className={`tag-dropdown-item ${selectedTag === tag ? 'active' : ''}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bin Quick Action */}
      {filterTab === 'bin' && deletedNotes.length > 0 && (
        <button onClick={onEmptyBin} className="notes-sidebar-empty-bin-btn">
          <Trash size={12} style={{ marginRight: '6px' }} />
          Empty Bin
        </button>
      )}

      {/* Notes List / Grid Render Container */}
      <div className={`notes-sidebar-list ${viewMode}`}>
        {sortedNotes.length > 0 ? (
          sortedNotes.map(note => {
            const isActive = activeNoteId === note.id;
            const noteColor = COLORS_MAP[note.color || 'default'];
            const plainExcerpt = getPlainText(note.body);
            const daysLeft = getRemainingDays(note.deletedAt);
            const isEditable = canEditNote(note, userRole, currentUser);
            const isDeletable = canDeleteNote(note, userRole, currentUser);

            return (
              <div 
                key={note.id}
                onClick={() => {
                  if (filterTab === 'all') {
                    setActiveNoteId(note.id);
                  }
                }}
                className={`notes-sidebar-item ${isActive ? 'active' : ''} ${filterTab === 'bin' ? 'bin-item' : ''}`}
                style={{
                  borderLeft: viewMode === 'list' ? `3px solid ${noteColor}` : undefined,
                  borderColor: viewMode === 'grid' ? noteColor : undefined
                }}
              >
                <div className="notes-sidebar-item-header">
                  <span className="notes-sidebar-item-title">
                    {note.title || 'Untitled Note'}
                  </span>
                  
                  {filterTab === 'all' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {renderAuthorBadge(note, isEditable)}
                      {note.isPinned && (
                        <Pin size={12} style={{ color: 'var(--text-primary)', fill: 'currentColor' }} />
                      )}
                    </div>
                  ) : (
                    <div className="notes-sidebar-item-bin-actions" onClick={(e) => e.stopPropagation()}>
                      {isDeletable ? (
                        <>
                          <button 
                            onClick={() => onRestoreNote(note.id)} 
                            className="notes-sidebar-item-action-btn"
                            title="Restore Note"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button 
                            onClick={() => onPermanentlyDeleteNote(note.id)} 
                            className="notes-sidebar-item-action-btn delete-btn"
                            title="Delete Permanently"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <span title="Only note author or owner can manage this deleted note" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          🔒
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {viewMode === 'grid' && (
                  <p className="notes-sidebar-item-excerpt">
                    {plainExcerpt || 'No content'}
                  </p>
                )}

                <div className="notes-sidebar-item-footer">
                  <span className="notes-sidebar-item-date">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>

                  {filterTab === 'bin' && (
                    <span className="notes-sidebar-item-expiry">
                      {daysLeft}d left
                    </span>
                  )}

                  {filterTab === 'all' && note.tags && note.tags.length > 0 && (
                    <div className="notes-sidebar-item-tags">
                      {note.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="notes-sidebar-item-tag-chip">
                          {tag}
                        </span>
                      ))}
                      {note.tags.length > 2 && (
                        <span className="notes-sidebar-item-tag-chip-more">
                          +{note.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="notes-sidebar-empty">
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              {searchQuery ? 'No matching notes found' : 'No notes available'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
