/**
 * Lazy libsodium loader.
 *
 * libsodium carries a WebAssembly payload that only matters once a container is
 * opened or written, so it is imported on demand instead of at module load.
 */

type SodiumModule = typeof import('libsodium-wrappers-sumo').default;

let loaded: SodiumModule | null = null;
let loading: Promise<SodiumModule> | null = null;

export function loadSodium(): Promise<SodiumModule> {
  loading ??= (async () => {
    const module = await import('libsodium-wrappers-sumo');
    const resolved = module.default ?? (module as unknown as SodiumModule);
    await resolved.ready;
    loaded = resolved;
    return resolved;
  })();

  return loading;
}

/** Already-loaded libsodium. Throws when called before `loadSodium()`. */
export function sodium(): SodiumModule {
  if (!loaded) throw new Error('libsodium is not loaded');
  return loaded;
}

/** Test hook: allow suites to await the same instance. */
export function isSodiumLoaded(): boolean {
  return loaded !== null;
}
