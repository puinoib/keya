import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/app/components/landing/LandingPage';

export const Route = createFileRoute('/')({
  component: LandingPage,
});
