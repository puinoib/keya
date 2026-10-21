import { createFileRoute } from '@tanstack/react-router';
import { AboutPage } from '@/app/components/settings/AboutPage';

export const Route = createFileRoute('/_authenticated/settings/about')({
  component: () => <AboutPage />,
});
