import { createFileRoute } from '@tanstack/react-router';
import { HelpLayout } from '@/help/components/HelpLayout';

export const Route = createFileRoute('/help/')({
  component: () => <HelpLayout />,
});
