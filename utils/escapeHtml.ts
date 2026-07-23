/**
 * Escapes special HTML characters (&, <, >, ", ') to their corresponding HTML entities.
 * Prevents XSS / HTML injection when rendering dynamic user data inside HTML string templates (e.g. expo-print PDFs).
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
