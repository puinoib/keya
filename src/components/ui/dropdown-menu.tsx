import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { cn } from '@/lib/utils';

const DropdownMenu = Menu.Root;
const DropdownMenuGroup = Menu.Group;

const DropdownMenuTrigger = Menu.Trigger;

function DropdownMenuContent({
  className,
  ...props
}: Menu.Popup.Props & { sideOffset?: number }) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={props.sideOffset ?? 4}>
        <Menu.Popup
          className={cn(
            'z-[70] min-w-[8rem] overflow-hidden rounded-md bg-canvas-raised border border-line p-1 shadow-dialog',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({
  className,
  ...props
}: Menu.Item.Props & { inset?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink-secondary outline-none',
        'transition-colors data-[highlighted]:bg-surface-5 data-[highlighted]:text-ink-primary',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Menu.Separator>) {
  return (
    <Menu.Separator
      className={cn('-mx-1 my-1 h-px bg-surface-6', className)}
      {...props}
    />
  );
}

const DropdownMenuSub = Menu.SubmenuRoot;

function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: Menu.SubmenuTrigger.Props & { inset?: boolean }) {
  return (
    <Menu.SubmenuTrigger
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink-secondary outline-none',
        'data-[highlighted]:bg-surface-5 data-[highlighted]:text-ink-primary data-[state=open]:bg-surface-5 data-[state=open]:text-ink-primary',
        className
      )}
      {...props}
    >
      {children}
      <svg
        className="ml-auto size-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Menu.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({ className, ...props }: Menu.Popup.Props) {
  return (
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup
          className={cn(
            'z-[70] min-w-[8rem] overflow-hidden rounded-md bg-canvas-raised border border-line p-1 shadow-dialog',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'ml-auto text-xs text-ink-quaternary tracking-widest',
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
