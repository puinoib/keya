import { createFileRoute } from '@tanstack/react-router';
import { ProvidersPage } from '@/app/components/settings/ProvidersPage';

export const Route = createFileRoute('/_authenticated/settings/providers')({
  component: () => <ProvidersPage />,
});
