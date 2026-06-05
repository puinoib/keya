import { createFileRoute } from '@tanstack/react-router';
import { KeysPage } from '@/app/components/settings/KeysPage';

export const Route = createFileRoute('/_authenticated/settings/keys')({
  component: () => <KeysPage />,
});
