import {
  createFileRoute,
  redirect,
  Outlet,
  useNavigate,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { useStore } from '@/app/store/useStore';
import { useAutoLock } from '@/app/hooks/useAutoLock';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const workspaceState = useStore.getState().workspaceState;

    if (workspaceState !== 'unlocked') {
      throw redirect({ to: '/start' });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const workspaceState = useStore((s) => s.workspaceState);
  useAutoLock();

  useEffect(() => {
    // beforeLoad only runs on navigation; also redirect after locking.
    if (workspaceState !== 'unlocked') {
      navigate({ to: '/start' });
    }
  }, [workspaceState, navigate]);

  return <Outlet />;
}
