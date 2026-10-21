import { createFileRoute } from '@tanstack/react-router';
import { ShortcutsPage } from '@/app/components/settings/ShortcutsPage';

export const Route = createFileRoute('/_authenticated/settings/shortcuts')({
  component: () => <ShortcutsPage />,
});
