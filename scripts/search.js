export function compileRegex(input, flags = 'i') {
  try {
    return input ? new RegExp(input, flags) : null;
  } catch {
    return null;
  }
}

export function highlight(text, re) {
  if (!re) return escapeHtml(text);
  // rebuild with global flag so all matches are wrapped
  const gre = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  return escapeHtml(text).replace(gre, m => `<mark>${m}</mark>`);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
