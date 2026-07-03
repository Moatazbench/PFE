export function formatRoleLabel(role) {
  var normalized = String(role || 'User').toUpperCase();
  if (normalized === 'ADMIN') return 'Director';
  return normalized
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
}
