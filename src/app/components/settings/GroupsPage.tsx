import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Folders, CaretRight } from '@phosphor-icons/react';
import { ManageGroupsDialog } from '../groups/ManageGroupsDialog';

export function GroupsPage() {
  const { db } = useStore();
  const groups = db?.getGroups() ?? [];
  const [showGroups, setShowGroups] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <Folders className="size-4" />
        </div>
        <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
          Groups
        </h1>
      </div>

      <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
        <button
          type="button"
          onClick={() => setShowGroups(true)}
          className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
        >
          <div>
            <p className="text-xs font-medium text-ink-primary">
              Manage Groups
            </p>
            <p className="text-xs text-ink-quaternary mt-0.5">
              Create, rename, and delete key groups
            </p>
          </div>
          <CaretRight className="size-3.5 text-ink-quaternary" />
        </button>
        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-quaternary">
              {groups.length} groups available
            </p>
            {groups.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-1.5">
                {groups.slice(0, 4).map((group) => (
                  <span
                    key={group.id}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-3 px-2 py-1 text-[11px] text-ink-secondary"
                  >
                    <span className="leading-none">{group.icon}</span>
                    <span>{group.name}</span>
                  </span>
                ))}
                {groups.length > 4 ? (
                  <span className="inline-flex items-center rounded-full border border-line bg-surface-3 px-2 py-1 text-[11px] text-ink-quaternary">
                    +{groups.length - 4}
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-xs text-ink-quaternary">No groups yet</span>
            )}
          </div>
        </div>
      </div>

      <ManageGroupsDialog
        open={showGroups}
        onClose={() => setShowGroups(false)}
      />
    </>
  );
}
