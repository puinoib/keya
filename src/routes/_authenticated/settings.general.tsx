import { createFileRoute } from '@tanstack/react-router';
import { GeneralPage } from '@/app/components/settings/GeneralPage';

export const Route = createFileRoute('/_authenticated/settings/general')({
  component: () => <GeneralPage />,
});
