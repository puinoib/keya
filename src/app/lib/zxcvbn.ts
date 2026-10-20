/**
 * Password strength estimation (zxcvbn) loaded on demand.
 *
 * The language dictionaries are several hundred kilobytes compressed, and they
 * are only needed once the user types a password. Importing this module must
 * therefore stay cheap: the estimator is imported on first use, not at module
 * load.
 */
import type { ZxcvbnResult } from '@zxcvbn-ts/core';

export type ZxcvbnEstimate = (password: string) => Promise<ZxcvbnResult>;

let loading: Promise<ZxcvbnEstimate> | null = null;

export function loadZxcvbn(): Promise<ZxcvbnEstimate> {
  loading ??= (async () => {
    const [core, commonPackage, enPackage] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ]);

    core.zxcvbnOptions.setOptions({
      dictionary: {
        ...commonPackage.dictionary,
        ...enPackage.dictionary,
      },
      graphs: commonPackage.adjacencyGraphs,
      useLevenshteinDistance: true,
      translations: enPackage.translations,
    });

    return core.zxcvbnAsync;
  })();
  return loading;
}
