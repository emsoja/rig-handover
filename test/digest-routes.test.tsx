import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// Temp runs dir: runs/ is read-only (AGENTS.md).
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      '{"at":"2026-01-01T23:00:00+01:00","job":"b/job","status":"retry","owner":"rook","error":"e1"}',
      '{"at":"2026-01-01T23:01:00+01:00","job":"b/job","status":"retry","owner":"rook","error":"e2"}',
      '{"at":"2026-01-01T23:02:00+01:00","job":"b/job","status":"retry","owner":"rook","error":"e3"}',
      '{"at":"2026-01-01T23:03:00+01:00","job":"a/job","status":"fail","owner":null,"error":"boom"}',
      '{"at":"2026-01-01T23:04:00+01:00","job":"c/job","sta',
    ].join('\n'),
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  process.env.LANE_MARKER = 'TEST-MARKER';
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

describe('GET /digest/:night', () => {
  it('200: rows sorted by job, fail and 3+ retries marked, banner present', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('fail ✕');
    expect(html).toContain('3 ⚠');
    expect(html).toContain('—'); // null owner
  });

  it('a bad line is counted, the night still renders', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    expect(html).toContain('1 line did not parse');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-01-03')).status).toBe(404);
  });

  it('empty night renders "nothing ran"', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});

describe('GET /api/digest/:night', () => {
  it('200: same jobs, same order as the page', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    expect(night.badLines).toBe(1);
    const html = await (await app.request('/digest/2026-01-01')).text();
    const order = night.rows.map((r) => html.indexOf(`<td>${r.job}</td>`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-01-03')).status).toBe(404);
  });

  it('empty night returns no rows', async () => {
    const night = (await (await app.request('/api/digest/2026-01-02')).json()) as Night;
    expect(night.rows).toEqual([]);
  });
});

describe('status board', () => {
  it('links each night to its digest with counts', async () => {
    const html = await (await app.request('/')).text();
    expect(html).toContain('href="/digest/2026-01-01"');
    expect(html).toContain('ok 0 · retry 3 · fail 1');
    expect(html).toContain('href="/digest/2026-01-02"');
  });
});
