import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useStore } from '@/app/store/useStore';
import { loadSession } from '@/app/lib/session';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const session = loadSession();
    const workspaceState = useStore.getState().workspaceState;

    // Allow access if there's a session (will be restored by SessionRestore) or already unlocked
    // Only redirect if there's no session AND not unlocked
    if (!session && workspaceState !== 'unlocked') {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
