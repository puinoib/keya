import { createFileRoute } from '@tanstack/react-router';
import { HelpLayout } from '@/help/components/HelpLayout';

export const Route = createFileRoute('/help/$slug')({
  component: HelpRoute,
});

function HelpRoute() {
  return <HelpLayout />;
}
