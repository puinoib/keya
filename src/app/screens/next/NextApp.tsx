/**
 * Entry point for the v2 stack.
 *
 * Exists next to the v1 UI so the new format can be exercised end to end before
 * the rest of the screens are migrated; when the migration is finished this
 * becomes the only entry and the v1 routes disappear.
 */

import { useEffect } from 'react';
import { useVault } from '@/app/store/next-vault';
import { UnlockScreen } from './UnlockScreen';
import { VaultScreen } from './VaultScreen';

export function NextApp() {
  const ready = useVault((state) => state.ready);
  const session = useVault((state) => state.session);

  useEffect(() => {
    if (!ready) void useVault.getState().init();
  }, [ready]);

  if (!ready) {
    return (
      <main className="p-8 text-sm text-ink-secondary">Opening Keya…</main>
    );
  }

  return session ? <VaultScreen /> : <UnlockScreen />;
}
