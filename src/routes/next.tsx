import { createFileRoute, redirect } from '@tanstack/react-router';

/** Kept so older links keep working; the entry point is `/start`. */
export const Route = createFileRoute('/next')({
  beforeLoad: () => {
    throw redirect({ to: '/start', replace: true });
  },
});
