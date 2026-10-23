import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AppLayout } from '@/app/components/layout/AppLayout';
import { KeysPage } from '@/app/components/keys/KeysPage';
import { useStore } from '@/app/store/useStore';
import { groupIdFromSearch } from '@/app/state/keys-search';
import { useEffect } from 'react';

const keysSearchSchema = z.object({
  select: z.string().optional(),
  view: z.enum(['active', 'archived']).optional().catch(undefined),
  group: z.string().max(200).optional().catch(undefined),
});

export const Route = createFileRoute('/_authenticated/keys')({
  validateSearch: keysSearchSchema,
  component: KeysRoute,
});

function KeysRoute() {
  const { select, view, group } = Route.useSearch();
  const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);
  const setShowArchived = useStore((s) => s.setShowArchived);
  const setFilterGroupId = useStore((s) => s.setFilterGroupId);

  // The location decides the scope and the group filter. Components write the
  // same state to the store so the list updates without waiting a render; this
  // effect is what makes back, forward and a reload agree with the URL.
  useEffect(() => {
    const archived = view === 'archived';
    setShowArchived(archived);
    setFilterGroupId(archived ? null : groupIdFromSearch(group));
  }, [view, group, setShowArchived, setFilterGroupId]);

  useEffect(() => {
    if (select) {
      setSelectedKeyId(select);
    }
  }, [select, setSelectedKeyId]);

  return (
    <AppLayout>
      <KeysPage />
    </AppLayout>
  );
}
