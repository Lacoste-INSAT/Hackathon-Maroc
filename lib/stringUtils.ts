export function formatName(name: string | null | undefined): string {
  if (!name) {
    return 'Unknown Patient';
  }
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatCode(code: string | null | undefined): string {
  if (!code) {
    return '—';
  }
  return code;
}
