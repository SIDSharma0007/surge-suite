/**
 * Role-Based Access Control (RBAC) helpers for Notes in Surge Suite.
 *
 * Rules:
 * - OWNER: Unrestricted create, edit, pin, and delete across all workspace notes.
 * - ADMIN: Can edit and delete Member notes and own Admin notes. CANNOT edit or delete OWNER notes.
 * - MEMBER: Can only edit and delete notes they created. All other notes are read-only.
 * - VIEWER: Read-only across all notes.
 */

export const canEditNote = (note, userRole = 'MEMBER', currentUser = null) => {
  if (!note || userRole === 'VIEWER') return false;
  if (userRole === 'OWNER') return true;

  const authorRole = note.author?.role || 'MEMBER';
  const authorUsername = note.author?.username || note.author?.displayName;
  const currentUsername = currentUser?.username;

  // Admin cannot edit Owner notes
  if (userRole === 'ADMIN') {
    return authorRole !== 'OWNER';
  }

  // Member can only edit notes they authored (or unauthored legacy notes)
  if (userRole === 'MEMBER') {
    if (!note.author) return true; // legacy note fallback
    if (authorRole === 'OWNER' || authorRole === 'ADMIN') return false;
    return authorUsername === currentUsername || note.author?.id === currentUser?.user_id;
  }

  return false;
};

export const canDeleteNote = (note, userRole = 'MEMBER', currentUser = null) => {
  if (!note || userRole === 'VIEWER') return false;
  if (userRole === 'OWNER') return true;

  const authorRole = note.author?.role || 'MEMBER';
  const authorUsername = note.author?.username || note.author?.displayName;
  const currentUsername = currentUser?.username;

  // Admin cannot delete Owner notes
  if (userRole === 'ADMIN') {
    return authorRole !== 'OWNER';
  }

  // Member can only delete their own notes
  if (userRole === 'MEMBER') {
    if (!note.author) return true; // legacy note fallback
    if (authorRole === 'OWNER' || authorRole === 'ADMIN') return false;
    return authorUsername === currentUsername || note.author?.id === currentUser?.user_id;
  }

  return false;
};
