import React from 'react';
import { formatShortName } from '../../utils/formatUser';

export default function NotesStatusBar({ bodyText, author, updatedAt }) {
  // Helper to strip HTML tags to compute accurate plain-text statistics
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

  // Count words dynamically by splitting on whitespaces
  const getWordCount = (text) => {
    if (!text) return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  const plainText = getPlainText(bodyText);
  const wordCount = getWordCount(plainText);
  const charCount = plainText.length;

  const role = author?.role || 'MEMBER';
  const rawUsername = author?.username || author?.displayName || 'Member';
  const shortName = formatShortName(author?.username, author?.displayName);

  return (
    <div className="notes-status-bar">
      <div className="notes-status-left">
        <span className="notes-status-draft-dot" />
        <span>Saved</span>
        <span style={{ margin: '0 6px', color: 'var(--border-medium)' }}>•</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }} title={`Author: ${rawUsername}`}>
          Author: <strong style={{ color: 'var(--text-primary)' }}>{role === 'OWNER' ? '👑 Owner' : role === 'ADMIN' ? '🛡️ Admin' : '👤 Member'} ({shortName})</strong>
        </span>
      </div>
      <div className="notes-status-right">
        <span>Words: {wordCount}</span>
        <span>Characters: {charCount}</span>
      </div>
    </div>
  );
}
