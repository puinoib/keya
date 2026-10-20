import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeSync } from '@/app/components/ThemeSync';
import { useAutoLock } from '@/app/hooks/useAutoLock';
import { BiometricPromptLayer } from '@/app/components/BiometricPromptLayer';
import { InboxSyncNotifier } from '@/app/components/InboxSyncNotifier';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useAutoLock();

  return (
    <>
      <ThemeSync />
      <div className="h-full animate-in fade-in-0 duration-300">
        <TooltipProvider>
          <Outlet />
          <BiometricPromptLayer />
          <InboxSyncNotifier />
        </TooltipProvider>
      </div>
      <Toaster />
      <TanStackRouterDevtools />
    </>
  );
}
