import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeSync } from '@/app/components/ThemeSync';
import { SessionRestore } from '@/app/components/SessionRestore';
import { BiometricPromptLayer } from '@/app/components/BiometricPromptLayer';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <ThemeSync />
      <SessionRestore>
        <TooltipProvider>
          <Outlet />
          <BiometricPromptLayer />
        </TooltipProvider>
        <Toaster />
      </SessionRestore>
      <TanStackRouterDevtools />
    </>
  );
}
