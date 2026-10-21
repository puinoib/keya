import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeSync } from '@/app/components/ThemeSync';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <ThemeSync />
      <div className="h-full animate-in fade-in-0 duration-300">
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>
      </div>
      <Toaster />
      <TanStackRouterDevtools />
    </>
  );
}
