import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useStore } from '@/app/store/useStore';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    const workspaceState = useStore.getState().workspaceState;
    if (workspaceState !== 'unlocked') {
      throw redirect({ to: '/' });
    }
  },
  component: () => <Outlet />,
});
