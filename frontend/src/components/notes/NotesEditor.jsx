import React, { useState, useRef, useEffect } from 'react';
import { Pin, Trash2, X } from 'lucide-react';
import NotesToolbar from './NotesToolbar';
import NotesStatusBar from './NotesStatusBar';

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

export default function NotesEditor({ note, onUpdate, onTogglePin, onDelete }) {
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
            aria-label="Note Title"
          />
          
          <div style={styles.headerControls}>
            {/* VIBGYOR Color Picker */}
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

            {/* Pin Action */}
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

            {/* Trash Action */}
            <button
              onClick={() => onDelete(note.id)}
              style={styles.headerBtn}
              title="Move to Bin"
              className="pin-btn-hover"
            >
              <Trash2 size={16} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        {/* Tag chips input row */}
        <div className="notes-editor-tags-container">
          {note.tags && note.tags.map(tag => (
            <span key={tag} className="notes-editor-tag-chip">
              {tag}
              <button 
                onClick={() => handleRemoveTag(tag)} 
                className="notes-editor-tag-delete-btn"
                title={`Remove ${tag}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder="+ Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            className="notes-editor-tag-input"
          />
        </div>
        
        <div
          ref={editorRef}
          className="notes-body-editable"
          contentEditable={true}
          onInput={handleInput}
          placeholder={bodyPlaceholder}
          aria-label="Note Body"
          style={{ outline: 'none', marginTop: '12px' }}
        />
      </div>
      
      {/* Floating Rich-Text Toolbar */}
      <NotesToolbar onFormat={handleFormatAction} />
      
      {/* Dynamic Status Bar */}
      <NotesStatusBar bodyText={note.body} />
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
