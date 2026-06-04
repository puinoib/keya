import { createFileRoute, redirect } from '@tanstack/react-router';
import { useStore } from '@/app/store/useStore';
import { WelcomePage } from '@/app/components/welcome/WelcomePage';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const workspaceState = useStore.getState().workspaceState;
    if (workspaceState === 'unlocked') {
      throw redirect({ to: '/keys' });
    }
  },
  component: WelcomePage,
});
