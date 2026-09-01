/**
 * Utility to intelligently format and shorten usernames, user IDs, and display names
 * for UI badges, cards, and banners.
 * 
 * Examples:
 *   - "user_c379c9c2ec2c40b7bbe1aff92612ae5e" -> "user_c379"
 *   - "sarah.connor@example.gov" -> "sarah.connor"
 *   - "alex_developer_account" -> "alex_devel.."
 *   - "alex" -> "alex"
 */
export function formatShortName(username, displayName) {
  if (displayName && typeof displayName === 'string' && displayName.trim()) {
    const trimmed = displayName.trim();
    if (trimmed.length > 14) return trimmed.substring(0, 11) + '..';
    return trimmed;
  }

  if (!username || typeof username !== 'string') {
    return 'User';
  }

  const raw = username.trim();

  // If email address, strip the domain part
  const clean = raw.includes('@') ? raw.split('@')[0] : raw;

  // If auto-generated UUID username (e.g. user_c379c9c2ec2c40b7bbe1aff92612ae5e)
  if (clean.startsWith('user_') && clean.length >= 12) {
    return clean.substring(0, 9); // e.g. "user_c379"
  }

  // If generic hex/uuid string (e.g. c379c9c2ec2c40b7bbe1aff92612ae5e)
  if (/^[0-9a-f]{20,}$/i.test(clean)) {
    return clean.substring(0, 7) + '..';
  }

  // If very long username
  if (clean.length > 14) {
    return clean.substring(0, 11) + '..';
  }

  return clean;
}
