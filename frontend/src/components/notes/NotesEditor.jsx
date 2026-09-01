import React, { useState, useRef, useEffect } from 'react';
import { Pin, Trash2, X, Lock, ShieldAlert } from 'lucide-react';
import NotesToolbar from './NotesToolbar';
import NotesStatusBar from './NotesStatusBar';
import { canEditNote, canDeleteNote } from '../../utils/notesPermissions';

const PLACEHOLDERS = [
  "What's on your mind...",
  "New song idea?",
  "Meeting notes...",
  "Write something wonderful...",
  "Don't lose this thought...",
  "Today's reflections...",
  "A story begins here...",
  "Things to remember...",
  "Late-night thoughts...",
  "Draft your next masterpiece...",
  "Capture your ideas...",
  "Project brainstorming...",
  "Your next big idea...",
  "Thoughts worth keeping...",
  "Where inspiration begins..."
];

const COLORS_PICK = [
  { id: 'default', color: 'transparent', label: 'Neutral' },
  { id: 'red', color: '#ef4444', label: 'Red' },
  { id: 'orange', color: '#f97316', label: 'Orange' },
  { id: 'yellow', color: '#f59e0b', label: 'Yellow' },
  { id: 'green', color: '#10b981', label: 'Green' },
  { id: 'blue', color: '#3b82f6', label: 'Blue' },
  { id: 'indigo', color: '#6366f1', label: 'Indigo' },
  { id: 'violet', color: '#8b5cf6', label: 'Violet' }
];

export default function NotesEditor({ note, onUpdate, onTogglePin, onDelete, currentUser, userRole }) {
  const editorRef = useRef(null);
  const [tagInput, setTagInput] = useState('');

  // Select a placeholder randomly on mount and keep it fixed
  const [bodyPlaceholder] = useState(() => {
    const idx = Math.floor(Math.random() * PLACEHOLDERS.length);
    return PLACEHOLDERS[idx];
  });

  // Keep references to note/onUpdate updated without re-triggering shortcut listeners
  const noteRef = useRef(note);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    noteRef.current = note;
    onUpdateRef.current = onUpdate;
  }, [note, onUpdate]);

  // Bind keyboard shortcuts (Cmd/Ctrl + B/I/U)
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta) {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          document.execCommand('bold', false, null);
          if (editorRef.current) {
            onUpdateRef.current({ ...noteRef.current, body: editorRef.current.innerHTML });
          }
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          document.execCommand('italic', false, null);
          if (editorRef.current) {
            onUpdateRef.current({ ...noteRef.current, body: editorRef.current.innerHTML });
          }
        } else if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          document.execCommand('underline', false, null);
          if (editorRef.current) {
            onUpdateRef.current({ ...noteRef.current, body: editorRef.current.innerHTML });
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // Initialize editor contents on mount
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== note.body) {
      editorRef.current.innerHTML = note.body || '';
    }
  }, []);

  const handleTitleChange = (e) => {
    onUpdate({ ...note, title: e.target.value });
  };

  const handleInput = () => {
    if (editorRef.current) {
      onUpdate({ ...note, body: editorRef.current.innerHTML });
    }
  };

  // Run native formatting commands
  const handleFormatAction = (command, value = null) => {
    document.execCommand(command, false, value);
    // Sync updates back to note state
    handleInput();
  };

  // Add tag handler
  const handleAddTag = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = tagInput.trim().toLowerCase();
      if (trimmed) {
        // Ensure # prefix
        const formatted = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
        const currentTags = note.tags || [];
        if (!currentTags.includes(formatted)) {
          onUpdate({ ...note, tags: [...currentTags, formatted] });
        }
      }
      setTagInput('');
    }
  };

  // Remove tag handler
  const handleRemoveTag = (tagToRemove) => {
    const currentTags = note.tags || [];
    onUpdate({ ...note, tags: currentTags.filter(t => t !== tagToRemove) });
  };

  // Permission checks
  const isEditable = canEditNote(note, userRole, currentUser);
  const isDeletable = canDeleteNote(note, userRole, currentUser);

  // Resolve accent color
  const activeColorObject = COLORS_PICK.find(c => c.id === (note.color || 'default'));
  const accentColor = activeColorObject?.id === 'default' ? 'transparent' : activeColorObject?.color;

  return (
    <div className="notes-editor-wrapper">
      <div 
        className="notes-editor-content"
        style={{ 
          borderTop: accentColor !== 'transparent' ? `4px solid ${accentColor}` : undefined,
          paddingTop: accentColor !== 'transparent' ? '20px' : '24px',
          transition: 'var(--transition-all)'
        }}
      >
        <div style={styles.headerContainer}>
          <input
            type="text"
            className="notes-title-input"
            placeholder="Title"
            value={note.title || ''}
            onChange={handleTitleChange}
            disabled={!isEditable}
            style={{
              cursor: !isEditable ? 'not-allowed' : 'text',
              opacity: !isEditable ? 0.85 : 1
            }}
            aria-label="Note Title"
          />
          
          <div style={styles.headerControls}>
            {/* VIBGYOR Color Picker (Only editable if allowed) */}
            {isEditable && (
              <div className="notes-color-picker-container">
                {COLORS_PICK.map(c => (
                  <div
                    key={c.id}
                    onClick={() => onUpdate({ ...note, color: c.id })}
                    className={`notes-color-picker-dot ${note.color === c.id || (!note.color && c.id === 'default') ? 'active' : ''}`}
                    style={{ 
                      backgroundColor: c.id === 'default' ? 'transparent' : c.color,
                      borderColor: c.id === 'default' ? 'var(--border-medium)' : 'transparent'
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            )}

            {/* Pin Action (Only editable if allowed) */}
            {isEditable && (
              <button
                onClick={() => onTogglePin(note.id)}
                style={styles.headerBtn}
                title={note.isPinned ? "Unpin Note" : "Pin Note"}
                className="pin-btn-hover"
              >
                <Pin 
                  size={16} 
                  style={{ 
                    color: note.isPinned ? 'var(--text-primary)' : 'var(--text-muted)',
                    fill: note.isPinned ? 'currentColor' : 'transparent',
                    transition: 'var(--transition-all)'
                  }} 
                />
              </button>
            )}

            {/* Trash Action */}
            {isDeletable && (
              <button
                onClick={() => onDelete(note.id)}
                style={styles.headerBtn}
                title="Move to Bin"
                className="pin-btn-hover"
              >
                <Trash2 size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Author & Timestamp Attribution Banner */}
        {(() => {
          const authorRole = note?.author?.role || 'MEMBER';
          const authorUsername = note?.author?.username || note?.author?.displayName || 'Member';
          const createdDate = note?.createdAt || note?.updatedAt;
          const formattedCreated = createdDate ? new Date(createdDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          const lastEditedUsername = note?.lastEditedBy?.username;
          const lastEditedRole = note?.lastEditedBy?.role;

          return (
            <div style={styles.authorBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Created by:</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: authorRole === 'OWNER' ? 'rgba(168, 85, 247, 0.12)' : authorRole === 'ADMIN' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                  color: authorRole === 'OWNER' ? '#c084fc' : authorRole === 'ADMIN' ? '#60a5fa' : '#4ade80',
                  border: `1px solid ${authorRole === 'OWNER' ? 'rgba(168, 85, 247, 0.25)' : authorRole === 'ADMIN' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`
                }}>
                  {authorRole === 'OWNER' ? '👑 Owner' : authorRole === 'ADMIN' ? '🛡️ Admin' : '👤 Member'} ({authorUsername})
                </span>
                {formattedCreated && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>on {formattedCreated}</span>
                )}
                {lastEditedUsername && lastEditedUsername !== authorUsername && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>
                    • Last edited by <strong>{lastEditedRole === 'OWNER' ? '👑 Owner' : lastEditedRole === 'ADMIN' ? '🛡️ Admin' : '👤 Member'} ({lastEditedUsername})</strong>
                  </span>
                )}
              </div>

              {!isEditable && (
                <div style={styles.protectedNotice}>
                  <Lock size={12} style={{ marginRight: '5px', color: '#f59e0b', flexShrink: 0 }} />
                  <span>
                    <strong>Protected Note:</strong> Authored by {authorRole === 'OWNER' ? '👑 Workspace Owner' : `${authorRole} (${authorUsername})`}. Only authorized roles can edit or delete this note.
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tag chips input row */}
        <div className="notes-editor-tags-container">
          {note.tags && note.tags.map(tag => (
            <span key={tag} className="notes-editor-tag-chip">
              {tag}
              {isEditable && (
                <button 
                  onClick={() => handleRemoveTag(tag)} 
                  className="notes-editor-tag-delete-btn"
                  title={`Remove ${tag}`}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
          {isEditable && (
            <input
              type="text"
              placeholder="+ Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="notes-editor-tag-input"
            />
          )}
        </div>
        
        <div
          ref={editorRef}
          className="notes-body-editable"
          contentEditable={isEditable}
          onInput={handleInput}
          placeholder={bodyPlaceholder}
          aria-label="Note Body"
          style={{ 
            outline: 'none', 
            marginTop: '12px',
            cursor: !isEditable ? 'default' : 'text'
          }}
        />
      </div>
      
      {/* Floating Rich-Text Toolbar (Only when editable) */}
      {isEditable && <NotesToolbar onFormat={handleFormatAction} />}
      
      {/* Dynamic Status Bar */}
      <NotesStatusBar bodyText={note.body} author={note.author} updatedAt={note.updatedAt} />
    </div>
  );
}

const styles = {
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-light)',
    marginBottom: '4px',
    paddingLeft: '48px' // Leave spacing for library toggle menu button
  },
  authorBanner: {
    padding: '4px 0 8px 48px',
    borderBottom: '1px dashed var(--border-light)',
    marginBottom: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  protectedNotice: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    marginTop: '4px',
    width: 'fit-content'
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  headerBtn: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-all)',
  }
};
