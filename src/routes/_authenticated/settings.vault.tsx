import { createFileRoute } from '@tanstack/react-router';
import { VaultPage } from '@/app/components/settings/VaultPage';

export const Route = createFileRoute('/_authenticated/settings/vault')({
  component: () => <VaultPage />,
});
