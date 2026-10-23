/**
 * §8.1 normalization and §5.3 expiry semantics.
 */

import { describe, expect, it } from 'vitest';
import { normalizeKeyaFile, checkIconForWriter } from '../payload/normalize';
import { validateKeyaFile } from '../payload/validate';
import { cloneFile } from './fixtures';
import { expiryCondition, expiryPoint, expiryStatus } from '../time/expiry';
import {
  formatTimestamp,
  isTimestamp,
  isCalendarDay,
} from '../time/timestamps';

describe('§8.1 normalization', () => {
  it('trims single-line fields and leaves descriptions alone', () => {
    const file = cloneFile();
    file.vault.name = '  Work  ';
    file.keys[0].name = ' Edge key ';
    file.keys[0].secret = ' sk-synthetic\n';
    file.keys[0].endpoint = ' https://edge.example.com/v1 ';
    file.keys[0].description = '  keep leading indent';
    file.providers[0].name = ' Edge Gateway ';
    file.providers[0].description = '\n  multi line\n';
    file.groups[0].name = ' Production ';
    file.keys[0].provider_id = file.providers[0].id;

    const normalized = normalizeKeyaFile(file);

    expect(normalized.vault.name).toBe('Work');
    expect(normalized.keys[0].name).toBe('Edge key');
    expect(normalized.keys[0].secret).toBe('sk-synthetic');
    expect(normalized.keys[0].endpoint).toBe('https://edge.example.com/v1');
    expect(normalized.keys[0].description).toBe('  keep leading indent');
    expect(normalized.providers[0].name).toBe('Edge Gateway');
    expect(normalized.providers[0].description).toBe('\n  multi line\n');
    expect(normalized.groups[0].name).toBe('Production');
  });

  it('lowercases and sorts static headers so bytes are stable', () => {
    const file = cloneFile();
    file.providers[0].probe = {
      target: 'models',
      auth: { mode: 'bearer' },
      headers: [
        { name: 'X-B', value: '2' },
        { name: 'x-a', value: '1' },
      ],
    };

    const once = normalizeKeyaFile(file);
    expect(once.providers[0].probe?.headers).toEqual([
      { name: 'x-a', value: '1' },
      { name: 'x-b', value: '2' },
    ]);

    // Normalization is idempotent.
    expect(normalizeKeyaFile(once)).toEqual(once);
  });

  it('trims header names and values', () => {
    const file = cloneFile();
    file.providers[0].probe = {
      target: ' models ',
      auth: { mode: 'header', name: ' x-api-key ' },
      headers: [{ name: ' x-a ', value: ' v ' }],
    };

    const normalized = normalizeKeyaFile(file);
    expect(normalized.providers[0].probe).toEqual({
      target: 'models',
      auth: { mode: 'header', name: 'x-api-key' },
      headers: [{ name: 'x-a', value: 'v' }],
    });
  });

  it('makes a whitespace-only secret fail validation instead of saving', () => {
    const file = cloneFile();
    file.keys[0].secret = '   \n\t ';
    const normalized = normalizeKeyaFile(file);
    const result = validateKeyaFile(normalized);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('too_short');
    }
  });

  it('rejects multi-cluster icons on the write path without truncating', () => {
    expect(checkIconForWriter('🚀')).toBe('ok');
    expect(checkIconForWriter('')).toBe('ok');
    expect(checkIconForWriter('🚀🚀')).toBe('clusters');
    expect(checkIconForWriter('👨‍👩‍👧‍👦')).toBe('ok');
    expect(checkIconForWriter('x'.repeat(65))).toBe('too_long');
  });
});

describe('§5.3 expiry semantics', () => {
  const day = { kind: 'date', value: '2026-03-01' } as const;

  it('a date expires at the end of that local day (device timezone)', () => {
    expect(formatTimestamp(expiryPoint(day, 'Pacific/Kiritimati')!)).toBe(
      '2026-03-01T10:00:00.000Z'
    );
    expect(formatTimestamp(expiryPoint(day, 'Etc/GMT+12')!)).toBe(
      '2026-03-02T12:00:00.000Z'
    );
  });

  it('the same instant yields opposite conclusions in two timezones', () => {
    const now = new Date('2026-03-01T20:00:00.000Z');
    // UTC+14: expiry point 03-01T10:00Z is already past.
    expect(expiryStatus(day, now, 'Pacific/Kiritimati')).toBe('expired');
    // UTC-12: expiry point 03-02T12:00Z is still 16 hours away.
    expect(expiryStatus(day, now, 'Etc/GMT+12')).toBe('upcoming');
  });

  it('an instant expiry is device independent', () => {
    const instant = {
      kind: 'instant',
      value: '2026-03-01T20:00:00.000Z',
    } as const;
    const now = new Date('2026-03-01T21:00:00.000Z');
    expect(expiryStatus(instant, now, 'Pacific/Kiritimati')).toBe('expired');
    expect(expiryStatus(instant, now, 'Etc/GMT+12')).toBe('expired');
  });

  it('resolves a day whose local midnight does not exist', () => {
    // Brazil shifted at 00:00 on 2018-11-04, so the day starts at 01:00 local.
    const point = expiryPoint(
      { kind: 'date', value: '2018-11-03' },
      'America/Sao_Paulo'
    );
    expect(formatTimestamp(point!)).toBe('2018-11-04T03:00:00.000Z');
  });

  it('reports upcoming inside the lead window', () => {
    const now = new Date('2026-02-25T00:00:00.000Z');
    expect(expiryStatus(day, now, 'UTC')).toBe('upcoming');
    expect(expiryStatus(day, new Date('2026-02-01T00:00:00.000Z'), 'UTC')).toBe(
      'ok'
    );
    expect(expiryStatus(null, now, 'UTC')).toBe('none');
  });

  it('keeps years below 100 in a date expiry', () => {
    expect(
      expiryPoint({ kind: 'date', value: '0050-01-01' }, 'UTC')?.toISOString()
    ).toBe('0050-01-02T00:00:00.000Z');
  });

  it('builds the condition string a dismissal binds to', () => {
    expect(expiryCondition(day)).toBe('date:2026-03-01');
    expect(
      expiryCondition({ kind: 'instant', value: '2026-03-01T10:00:00.000Z' })
    ).toBe('instant:2026-03-01T10:00:00.000Z');
    expect(expiryCondition(null)).toBeNull();
  });
});

describe('§5.3 timestamp grammar', () => {
  it('round-trips canonical timestamps', () => {
    const value = '2026-03-01T10:00:00.000Z';
    expect(isTimestamp(value)).toBe(true);
    expect(formatTimestamp(new Date(value))).toBe(value);
  });

  it('refuses lenient forms that Date.parse would accept', () => {
    for (const value of [
      '2026-02-29T00:00:00.000Z',
      '2026-01-01T24:00:00.000Z',
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.000+00:00',
      '2026-1-1T00:00:00.000Z',
    ]) {
      expect(isTimestamp(value), value).toBe(false);
    }
  });

  it('keeps years below 100 intact', () => {
    expect(isTimestamp('0050-01-01T00:00:00.000Z')).toBe(true);
    expect(isCalendarDay('0050-01-01')).toBe(true);
  });

  it('rejects impossible calendar days', () => {
    for (const value of ['2026-02-30', '2026-13-01', '2023-02-29']) {
      expect(isCalendarDay(value), value).toBe(false);
    }
    expect(isCalendarDay('2024-02-29')).toBe(true);
  });
});
