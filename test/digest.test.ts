import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  const n = readNight('runs', '2026-10-28');

  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    expect(n).not.toBeNull();
    expect(n!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(n!.badLines).toBe(1);
  });

  it('counts runs and retries and keeps the last status and error', () => {
    const f = n!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(f).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(f.first).toBe('2026-10-29T01:30:00+01:00');
    expect(f.last).toBe('2026-10-29T01:37:00+01:00');
    const b = n!.rows.find((r) => r.job === 'notes/backup')!;
    expect(b).toMatchObject({ runs: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row with a null owner', () => {
    expect(n!.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });
});
