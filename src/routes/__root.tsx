import { lazy, Suspense } from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeSync } from '@/app/components/ThemeSync';

export const Route = createRootRoute({
  component: RootComponent,
});

// The router devtools are opt-in: the floating badge sits over the app in
// development and is noise unless you are debugging routes. The dynamic import
// is dropped from production builds with the rest of the branch.
const RouterDevtools =
  import.meta.env.DEV && import.meta.env.VITE_ROUTER_DEVTOOLS === 'true'
    ? lazy(() =>
        import('@tanstack/react-router-devtools').then((module) => ({
          default: module.TanStackRouterDevtools,
        }))
      )
    : null;

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
      {RouterDevtools && (
        <Suspense fallback={null}>
          <RouterDevtools />
        </Suspense>
      )}
    </>
  );
}
