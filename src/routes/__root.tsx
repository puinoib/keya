import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeSync } from '@/app/components/ThemeSync';
import { SessionRestore } from '@/app/components/SessionRestore';
import { BiometricPromptLayer } from '@/app/components/BiometricPromptLayer';
import { InboxSyncNotifier } from '@/app/components/InboxSyncNotifier';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <ThemeSync />
      <SessionRestore>
        <>
          <div className="animate-in fade-in-0 duration-300">
            <TooltipProvider>
              <Outlet />
              <BiometricPromptLayer />
              <InboxSyncNotifier />
            </TooltipProvider>
          </div>
          <Toaster />
        </>
      </SessionRestore>
      <TanStackRouterDevtools />
    </>
  );
}
