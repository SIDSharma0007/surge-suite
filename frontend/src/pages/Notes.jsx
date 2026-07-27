import React from 'react';
import EmptyNotesState from '../components/notes/EmptyNotesState';
import NotesEditor from '../components/notes/NotesEditor';
import '../components/notes/Notes.css';

export default function Notes({
  notes,
  activeNoteId,
  setActiveNoteId,
  onNewNote,
  onUpdateNote,
  onTogglePin
}) {
  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  return (
    <div className="notes-container">
      {activeNote ? (
        <NotesEditor 
          key={activeNote.id}
          note={activeNote} 
          onUpdate={onUpdateNote}
          onTogglePin={onTogglePin}
        />
      ) : (
        <EmptyNotesState onCreateNote={onNewNote} />
      )}
    </div>
  );
}
