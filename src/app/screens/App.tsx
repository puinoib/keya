/**
 * Application entry: unlock a vault, or create one.
 *
 * The tab bar and the screen switch live in `VaultScreen`; this component only
 * decides between "locked" and "unlocked".
 */

import { useEffect } from 'react';
import { useVault } from '@/app/store/vault';
import { UnlockScreen } from './UnlockScreen';
import { VaultScreen } from './VaultScreen';

export function App() {
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
