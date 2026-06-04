import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/app/components/layout/AppLayout';
import { KeysPage } from '@/app/components/keys/KeysPage';

export const Route = createFileRoute('/_authenticated/keys')({
  component: () => (
    <AppLayout>
      <KeysPage />
    </AppLayout>
  ),
});
