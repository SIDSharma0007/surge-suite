import React, { useState, useRef, useEffect } from 'react';
import { Pin } from 'lucide-react';
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

export default function NotesEditor({ note, onUpdate, onTogglePin }) {
  const editorRef = useRef(null);

  // Select a placeholder randomly on mount and keep it fixed
  const [bodyPlaceholder] = useState(() => {
    const idx = Math.floor(Math.random() * PLACEHOLDERS.length);
    return PLACEHOLDERS[idx];
  });

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

  return (
    <div className="notes-editor-wrapper">
      <div className="notes-editor-content">
        <div style={styles.headerContainer}>
          <input
            type="text"
            className="notes-title-input"
            placeholder="Title"
            value={note.title || ''}
            onChange={handleTitleChange}
            aria-label="Note Title"
          />
          <button
            onClick={() => onTogglePin(note.id)}
            style={styles.pinBtn}
            title={note.isPinned ? "Unpin Note" : "Pin Note"}
            className="pin-btn-hover"
          >
            <Pin 
              size={18} 
              style={{ 
                color: note.isPinned ? 'var(--text-primary)' : 'var(--text-muted)',
                fill: note.isPinned ? 'currentColor' : 'transparent',
                transition: 'var(--transition-all)'
              }} 
            />
          </button>
        </div>
        
        <div
          ref={editorRef}
          className="notes-body-editable"
          contentEditable={true}
          onInput={handleInput}
          placeholder={bodyPlaceholder}
          aria-label="Note Body"
          style={{ outline: 'none' }}
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
    marginBottom: '8px',
  },
  pinBtn: {
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
