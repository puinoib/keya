import { useState, type ReactNode } from 'react';
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

  return (
    <div className="py-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1.5 mb-1 group cursor-pointer"
      >
        <div className="flex items-center gap-1">
          <Icon className="size-3 text-ink-quaternary" />
          <span className="text-xs font-medium text-ink-quaternary uppercase tracking-wider">
            {label}
          </span>
          <CaretDown
            className={`size-2.5 text-ink-quaternary transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          />
        </div>
        <div className="w-5 h-5 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            {action}
          </span>
        </div>
      </button>
      {open && <div className="space-y-px">{children}</div>}
    </div>
  );
}
