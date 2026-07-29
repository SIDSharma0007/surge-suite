import React, { useState } from 'react';
import { Menu, FolderClosed, BookOpen } from 'lucide-react';
import NotesSidebar from '../components/notes/NotesSidebar';
import EmptyNotesState from '../components/notes/EmptyNotesState';
import NotesEditor from '../components/notes/NotesEditor';
import '../components/notes/Notes.css';

export default function Notes({
  notes,
  deletedNotes,
  activeNoteId,
  setActiveNoteId,
  onNewNote,
  onUpdateNote,
  onTogglePin,
  onDeleteNote,
  onRestoreNote,
  onPermanentlyDeleteNote,
  onEmptyBin
}) {
  const [showLibrary, setShowLibrary] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' or 'bin'
  const [selectedTag, setSelectedTag] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  return (
    <div className="notes-container">
      {/* Collapsible Left Notes Library Sidebar */}
      {showLibrary && (
        <NotesSidebar
          notes={notes}
          deletedNotes={deletedNotes}
          activeNoteId={activeNoteId}
          setActiveNoteId={setActiveNoteId}
          onNewNote={onNewNote}
          onRestoreNote={onRestoreNote}
          onPermanentlyDeleteNote={onPermanentlyDeleteNote}
          onEmptyBin={onEmptyBin}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterTab={filterTab}
          setFilterTab={setFilterTab}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      )}

      {/* Right Content Editor Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', position: 'relative' }}>
        
        {/* Toggle Library Button bar at top left of editor */}
        <div style={styles.topControlBar}>
          <button 
            onClick={() => setShowLibrary(!showLibrary)}
            className="notes-library-toggle-btn"
            title={showLibrary ? "Hide Notes Library" : "Show Notes Library"}
          >
            <Menu size={16} />
          </button>
        </div>

        {activeNote ? (
          <NotesEditor 
            key={activeNote.id}
            note={activeNote} 
            onUpdate={onUpdateNote}
            onTogglePin={onTogglePin}
            onDelete={onDeleteNote}
          />
        ) : (
          <EmptyNotesState onCreateNote={onNewNote} />
        )}
      </div>
    </div>
  );
}

const styles = {
  topControlBar: {
    position: 'absolute',
    top: '24px',
    left: '24px',
    zIndex: 15,
  }
};
