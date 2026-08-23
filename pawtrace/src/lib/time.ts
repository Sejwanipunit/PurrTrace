export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Reports older than this are hidden from the public feed/map/search. */
export const REPORT_TTL_DAYS = 30;

export function isFreshReport(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < REPORT_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}
