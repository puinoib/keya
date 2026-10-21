/**
 * §16.2 — plaintext and class A validation.
 *
 * Each test name carries the spec item number so "which spec items are green"
 * stays a mechanical question.
 */

import { describe, expect, it } from 'vitest';
import { validateKeyaFile } from '../payload/validate';
import { cloneFile, IDS, makeProvider } from './fixtures';

const reject = (mutate: (file: ReturnType<typeof cloneFile>) => void) => {
  const file = cloneFile();
  mutate(file);
  return validateKeyaFile(file);
};

const pathsOf = (result: ReturnType<typeof validateKeyaFile>) =>
  result.ok ? [] : result.issues.map((issue) => issue.path);

describe('§16.2 class A validation', () => {
  it('accepts the baseline fixture', () => {
    const result = validateKeyaFile(cloneFile());
    expect(result.ok).toBe(true);
  });

  it('11 rejects a string carrying a lone surrogate', () => {
    const issues = rejectResult((file) => {
      file.keys[0].name = 'broken \uD800 name';
    });
    expect(issues.map((issue) => issue.path)).toContain('keys[0].name');
    expect(issues.map((issue) => issue.code)).toContain('bad_charset');
  });

  it('12 rejects unknown and missing fields with a path', () => {
    const unknown = reject((file) => {
      (file as unknown as Record<string, unknown>).schema_version = 1;
    });
    expect(pathsOf(unknown)).toContain('$.schema_version');

    const nested = reject((file) => {
      (file.keys[0] as unknown as Record<string, unknown>).revision = 'x';
    });
    expect(pathsOf(nested)).toContain('keys[0].revision');

    const missing = reject((file) => {
      delete (file.keys[0] as unknown as Record<string, unknown>).secret;
    });
    expect(pathsOf(missing)).toContain('keys[0].secret');
  });

  it('13 rejects duplicate ids', () => {
    const result = reject((file) => {
      file.groups.push({ ...file.groups[0] });
    });
    expect(pathsOf(result)).toContain('groups[1].id');
  });

  it('14 rejects dangling references', () => {
    const group = reject((file) => {
      file.keys[0].group_id = '55555555-5555-4555-8555-555555555555';
    });
    expect(pathsOf(group)).toContain('keys[0].group_id');

    const provider = reject((file) => {
      file.keys[0].provider_id = 'custom:55555555-5555-4555-8555-555555555555';
    });
    expect(pathsOf(provider)).toContain('keys[0].provider_id');

    // An unknown preset slug is a runtime capability, not a file error.
    const preset = reject((file) => {
      file.keys[0].provider_id = 'preset:not-shipped-yet';
    });
    expect(preset.ok).toBe(true);
  });

  it('15 rejects header tokens carrying separators or spaces', () => {
    for (const name of ['x-api-key\r\nX-Evil: 1', 'x api key', 'x:y']) {
      const result = reject((file) => {
        file.providers[0].probe = {
          target: 'models',
          auth: { mode: 'header', name },
          headers: [],
        };
      });
      expect(result.ok).toBe(false);
    }
  });

  it('16 rejects forbidden and malformed static headers', () => {
    const cases: ((file: ReturnType<typeof cloneFile>) => void)[] = [
      (file) => {
        file.providers[0].probe!.headers = [
          { name: 'authorization', value: 'x' },
        ];
      },
      (file) => {
        file.providers[0].probe!.headers = [{ name: 'host', value: 'x' }];
      },
      (file) => {
        file.providers[0].probe!.headers = [{ name: 'cookie', value: 'x' }];
      },
      (file) => {
        file.providers[0].probe!.headers = [{ name: 'sec-foo', value: 'x' }];
      },
      (file) => {
        file.providers[0].probe!.headers = [{ name: 'proxy-x', value: 'x' }];
      },
      (file) => {
        file.providers[0].probe!.headers = [{ name: 'x-a', value: ' x ' }];
      },
      (file) => {
        file.providers[0].probe!.headers = [{ name: 'x-a', value: 'a\r\nb' }];
      },
      (file) => {
        file.providers[0].probe!.headers = [
          { name: 'x-a', value: 'tab\there' },
        ];
      },
      (file) => {
        file.providers[0].probe!.headers = [
          { name: 'x-a', value: '1' },
          { name: 'X-A', value: '2' },
        ];
      },
      (file) => {
        file.providers[0].probe!.headers = [{ name: 'x-api-key', value: '1' }];
      },
      (file) => {
        file.providers[0].probe!.headers = Array.from(
          { length: 9 },
          (_, i) => ({
            name: `x-h${i}`,
            value: 'v',
          })
        );
      },
    ];

    for (const mutate of cases) expect(reject(mutate).ok).toBe(false);
  });

  it('17 rejects endpoint shapes that are not base addresses', () => {
    for (const endpoint of [
      'https://user:pass@example.com/v1',
      'https://example.com/v1#frag',
      'https://example.com/v1?x=1',
      'ftp://example.com/v1',
      'not a url',
    ]) {
      const result = reject((file) => {
        file.keys[0].endpoint = endpoint;
      });
      expect(result.ok, endpoint).toBe(false);
    }
  });

  it('18 rejects impossible calendar days, accepts leap days', () => {
    for (const value of ['2026-02-30', '2026-13-01', '2026-1-1']) {
      const result = reject((file) => {
        file.keys[0].expiry = { kind: 'date', value };
      });
      expect(result.ok, value).toBe(false);
    }

    const leap = reject((file) => {
      file.keys[0].expiry = { kind: 'date', value: '2024-02-29' };
    });
    expect(leap.ok).toBe(true);
  });

  it('19 validates timestamps by round-trip, not by Date.parse leniency', () => {
    for (const value of [
      '2026-02-29T00:00:00.000Z',
      '2026-01-01T24:00:00.000Z',
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.000+00:00',
      '2026-1-1T00:00:00.000Z',
    ]) {
      const result = reject((file) => {
        file.keys[0].created_at = value;
      });
      expect(result.ok, value).toBe(false);
    }

    // Years below 100 must not be remapped to the 1900s.
    const old = reject((file) => {
      file.keys[0].created_at = '0050-01-01T00:00:00.000Z';
    });
    expect(old.ok).toBe(true);
  });

  it('20 accepts only lowercase, version 4, RFC variant uuids', () => {
    for (const id of [
      '11111111-1111-1111-8111-111111111111', // version 1
      '11111111-1111-4111-c111-111111111111', // bad variant
      '11111111-1111-4111-8111-11111111111A', // uppercase
      '11111111111141118111111111111111', // no dashes
    ]) {
      const result = reject((file) => {
        file.groups[0].id = id;
      });
      expect(result.ok, id).toBe(false);
    }
  });

  it('21 enforces length and count limits', () => {
    const longName = reject((file) => {
      file.keys[0].name = 'x'.repeat(201);
    });
    expect(longName.ok).toBe(false);

    const manyGroups = reject((file) => {
      file.groups = Array.from({ length: 501 }, (_, index) => ({
        id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
        name: 'g',
        icon: '',
        order: 0,
      }));
    });
    expect(manyGroups.ok).toBe(false);
  });

  it('22 requires provider names to be unique within the file', () => {
    const result = reject((file) => {
      file.providers.push(
        makeProvider({ id: `custom:${IDS.vault}`, name: 'EDGE gateway' })
      );
    });
    expect(pathsOf(result)).toContain('providers[1].name');
  });

  it('23 keeps reader-side icon validation to bytes', () => {
    // Two grapheme clusters under the byte cap are legal for a reader; only the
    // writer refuses them (grapheme segmentation is not portable).
    const twoClusters = reject((file) => {
      file.vault.icon = '🚀🚀';
    });
    expect(twoClusters.ok).toBe(true);

    const tooLong = reject((file) => {
      file.vault.icon = 'x'.repeat(65);
    });
    expect(tooLong.ok).toBe(false);
  });

  it('rejects control characters in free text but allows tab, newline, CR', () => {
    const control = reject((file) => {
      file.keys[0].secret = 'sk\u0000secret';
    });
    expect(control.ok).toBe(false);

    const multiline = reject((file) => {
      file.keys[0].secret = '-----BEGIN-----\nbody\r\n-----END-----\n';
    });
    expect(multiline.ok).toBe(true);
  });

  it('accepts a query in probe.target but rejects a colliding credential param', () => {
    const withQuery = reject((file) => {
      file.providers[0].probe = {
        target: 'models?api-version=2024-10-21',
        auth: { mode: 'header', name: 'api-key' },
        headers: [],
      };
    });
    expect(withQuery.ok).toBe(true);

    const collision = reject((file) => {
      file.providers[0].probe = {
        target: 'models?key=static',
        auth: { mode: 'query', param: 'key' },
        headers: [],
      };
    });
    expect(collision.ok).toBe(false);
    expect(pathsOf(collision)).toContain('providers[0].probe.auth.param');
  });

  it('rejects expiry value shapes that do not match the kind', () => {
    const dateWithTimestamp = reject((file) => {
      file.keys[0].expiry = {
        kind: 'date',
        value: '2026-03-01T00:00:00.000Z',
      };
    });
    expect(dateWithTimestamp.ok).toBe(false);

    const instantWithDay = reject((file) => {
      file.keys[0].expiry = { kind: 'instant', value: '2026-03-01' };
    });
    expect(instantWithDay.ok).toBe(false);
  });

  it('rejects null icons — the empty string is the only "no icon" encoding', () => {
    const result = reject((file) => {
      (file.vault as unknown as Record<string, unknown>).icon = null;
    });
    expect(result.ok).toBe(false);
  });

  it('summarises issues for user-facing messages', async () => {
    const { summarizeIssues } = await import('../payload/validate');
    const result = reject((file) => {
      file.keys[0].name = '';
      file.keys[0].created_at = 'nope';
    });
    if (result.ok) throw new Error('expected rejection');
    const message = summarizeIssues(result.issues);
    expect(message).toContain('keys[0].name');
    expect(message).toContain('keys[0].created_at');
  });
});

// Helper kept at the bottom so the tests above read top-down.
function rejectResult(mutate: (file: ReturnType<typeof cloneFile>) => void) {
  const result = reject(mutate);
  return result.ok ? [] : result.issues;
}
