import React from 'react';
import { BookOpen, Plus } from 'lucide-react';

export default function EmptyNotesState({ onCreateNote }) {
  return (
    <div className="notes-empty-state">
      <BookOpen size={48} strokeWidth={1.25} className="notes-empty-icon" />
      <h3 className="notes-empty-title">No note selected</h3>
      <p className="notes-empty-text">Create a new note to start writing.</p>
      <button onClick={onCreateNote} className="notes-btn-primary">
        <Plus size={16} style={{ marginRight: '8px' }} />
        New Note
      </button>
    </div>
  );
}
