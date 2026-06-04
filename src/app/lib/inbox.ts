import type { InboxItem } from '../../core/types';

export function getInboxToastCopy(summary: {
  added: number;
  updated: number;
  archived: number;
}): { title: string; description: string } | null {
  if (summary.added <= 0) return null;

  return {
    title:
      summary.added === 1
        ? 'New reminder added to Inbox'
        : `${summary.added} reminders added to Inbox`,
    description:
      summary.updated > 0
        ? `${summary.updated} existing reminder${summary.updated > 1 ? 's were' : ' was'} refreshed as well.`
        : 'Review expiring keys and archive each reminder after you handle it.',
  };
}

export function formatInboxItemTime(item: InboxItem): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(item.metadata.expires_at));
}
