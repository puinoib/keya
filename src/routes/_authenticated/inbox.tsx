import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/app/components/layout/AppLayout';
import { InboxPage } from '@/app/components/inbox/InboxPage';

export const Route = createFileRoute('/_authenticated/inbox')({
  component: () => (
    <AppLayout topbar="minimal">
      <InboxPage />
    </AppLayout>
  ),
});
