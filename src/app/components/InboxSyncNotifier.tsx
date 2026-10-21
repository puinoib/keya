import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';
import { getInboxToastCopy } from '../lib/inbox';

export function InboxSyncNotifier() {
  const navigate = useNavigate();
  const lastInboxSyncAt = useStore((s) => s.lastInboxSyncAt);
  const lastInboxSyncResult = useStore((s) => s.lastInboxSyncResult);
  const lastSeenSyncAt = useRef<string | null>(null);

  useEffect(() => {
    if (!lastInboxSyncAt || !lastInboxSyncResult) return;
    if (lastSeenSyncAt.current === lastInboxSyncAt) return;
    lastSeenSyncAt.current = lastInboxSyncAt;

    const copy = getInboxToastCopy(lastInboxSyncResult);
    if (!copy) return;

    toast.warning(copy.title, {
      description: copy.description,
      action: {
        label: 'Open Inbox',
        onClick: () => navigate({ to: '/inbox' }),
      },
    });
  }, [lastInboxSyncAt, lastInboxSyncResult, navigate]);

  return null;
}
