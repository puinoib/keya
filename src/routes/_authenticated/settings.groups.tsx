import { createFileRoute } from '@tanstack/react-router';
import { GroupsPage } from '@/app/components/settings/GroupsPage';

export const Route = createFileRoute('/_authenticated/settings/groups')({
  component: () => <GroupsPage />,
});
