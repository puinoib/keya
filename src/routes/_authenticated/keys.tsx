import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AppLayout } from '@/app/components/layout/AppLayout';
import { KeysPage } from '@/app/components/keys/KeysPage';
import { useStore } from '@/app/store/useStore';
import { useEffect } from 'react';

const keysSearchSchema = z.object({
  select: z.string().optional(),
});

export const Route = createFileRoute('/_authenticated/keys')({
  validateSearch: keysSearchSchema,
  component: () => {
    const { select } = Route.useSearch();
    const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);

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
  },
});
