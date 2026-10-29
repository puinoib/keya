import { useId, useState, type ReactNode } from 'react';
import { CaretDown } from '@phosphor-icons/react';

interface Props {
  icon: React.ElementType;
  label: string;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SidebarSection({
  icon: Icon,
  label,
  action,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="py-1.5">
      <div className="w-full flex items-center justify-between px-2.5 mb-1 group">
        {/* A real button, with the section's action beside it rather than
            inside: a click on the gear must not also collapse the section,
            and Return has to do what a click does. */}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <Icon className="size-3 shrink-0 text-ink-quaternary" />
          <span className="text-xs font-medium text-ink-quaternary uppercase tracking-wider">
            {label}
          </span>
          <CaretDown
            className={`size-2.5 shrink-0 text-ink-quaternary transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          />
        </button>
        <div className="w-5 h-5 flex items-center justify-center">
          {/* The action is hidden until the row is hovered or focused. Without
              the focus-within rule it stays invisible but reachable by Tab. */}
          <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {action}
          </span>
        </div>
      </div>
      <div id={contentId} className="space-y-px">
        {open ? children : null}
      </div>
    </div>
  );
}
