import { createFileRoute } from '@tanstack/react-router';
import { VaultHealthPage } from '@/app/components/audit/VaultHealthPage';
import { AppLayout } from '@/app/components/layout/AppLayout';

export const Route = createFileRoute('/_authenticated/health')({
  component: () => (
    <AppLayout>
      <VaultHealthPage />
    </AppLayout>
  ),
});
