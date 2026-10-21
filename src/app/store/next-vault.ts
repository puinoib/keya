/**
 * The v2 store singleton. Components import this; nothing else instantiates it.
 */

import { createVaultStore } from './vault-store';
import { browserVaultPlatform } from '../storage/browser-platform';

export const useVault = createVaultStore(browserVaultPlatform);
