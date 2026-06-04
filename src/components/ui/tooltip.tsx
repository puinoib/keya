import * as React from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;

// Backward-compatible Trigger: supports Radix-style `asChild`
const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  TooltipPrimitive.Trigger.Props & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    const child = React.Children.only(children) as React.ReactElement<
      Record<string, unknown>
    >;
    return (
      <TooltipPrimitive.Trigger ref={ref} render={child} {...props} />
    );
  }
  return (
    <TooltipPrimitive.Trigger ref={ref} {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  );
});
TooltipTrigger.displayName = 'TooltipTrigger';

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipPrimitive.Popup.Props & { sideOffset?: number }
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner sideOffset={sideOffset}>
      <TooltipPrimitive.Popup
        ref={ref}
        className={cn(
          'z-50 overflow-hidden rounded-md bg-canvas-hover border border-line px-3 py-1.5',
          'text-xs text-ink-secondary shadow-elevated',
          'animate-in fade-in-0 zoom-in-95',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
