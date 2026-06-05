import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/app/components/layout/AppLayout';
import { VaultHealthPage } from '@/app/components/audit/VaultHealthPage';

export const Route = createFileRoute('/_authenticated/health')({
  component: () => (
    <AppLayout topbar="minimal">
      <VaultHealthPage />
    </AppLayout>
  ),
});
