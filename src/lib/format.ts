export function humanSize(n: number | bigint | null | undefined): string {
  if (n === null || n === undefined) return '0 B';
  let num = typeof n === 'bigint' ? Number(n) : n;
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (num >= 1024 && i < u.length - 1) {
    num /= 1024;
    i++;
  }
  return `${num.toFixed(1)} ${u[i]}`;
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
