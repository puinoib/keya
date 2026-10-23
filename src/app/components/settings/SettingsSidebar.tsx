import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { SETTINGS_NAV } from './nav';

export function SettingsSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside className="w-48 shrink-0 flex flex-col gap-4 overflow-y-auto bg-canvas-panel px-2 pt-3 pb-2 scrollbar-hidden">
      <button
        type="button"
        onClick={() => navigate({ to: '/keys' })}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to app</span>
      </button>

      {SETTINGS_NAV.map((group) => (
        <div key={group.id} className="space-y-0.5">
          {/* A group of one (About) is named by its item, so the caption would
              only repeat it. */}
          {group.items.length > 1 && (
            <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-quaternary/70">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  isActive
                    ? 'bg-accent/35 text-accent-bright font-medium'
                    : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3'
                }`}
              >
                <item.icon
                  className="size-3.5"
                  weight={isActive ? 'fill' : 'regular'}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
