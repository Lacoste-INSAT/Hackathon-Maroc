export function formatName(name: string | null | undefined): string {
  if (!name || name.startsWith('exp://') || name.startsWith('http://') || name.startsWith('https://')) {
    return 'Unknown Patient';
  }
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatCode(code: string | null | undefined): string {
  if (!code || code.startsWith('exp://') || code.startsWith('http')) {
    return '—';
  }
  return code;
}
