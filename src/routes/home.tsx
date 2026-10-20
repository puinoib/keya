import { createFileRoute } from '@tanstack/react-router';
import { LandingPage } from '@/app/components/landing/LandingPage';

/**
 * Always-available entry to the landing page, for users who already have a
 * workspace and would otherwise be redirected away from `/`.
 */
export const Route = createFileRoute('/home')({
  component: LandingPage,
});
