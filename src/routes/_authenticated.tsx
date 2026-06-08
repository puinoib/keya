import {
  createFileRoute,
  redirect,
  Outlet,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { useStore } from '@/app/store/useStore';
import { hasSession } from '@/app/lib/session';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const hasSess = hasSession();
    const workspaceState = useStore.getState().workspaceState;

    // Allow access if there's a session (will be restored by SessionRestore) or already unlocked
    // Only redirect if there's no session AND not unlocked
    if (!hasSess && workspaceState !== 'unlocked') {
      throw redirect({ to: '/start' });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const workspaceState = useStore((s) => s.workspaceState);

  useEffect(() => {
    // After the vault is locked (manually, by auto-lock, or session restore failure),
    // redirect to home since beforeLoad only runs on navigation.
    if (workspaceState !== 'unlocked' && !hasSession()) {
      navigate({ to: '/start' });
    }
  }, [workspaceState, navigate]);

  return <Outlet />;
}
