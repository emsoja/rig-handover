import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

// Parse at the edge (styleguide): a line is a RunLine or it is null.
export function parseLine(line: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || o.job === '') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status as RunStatus)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  const r: RunLine = { at: o.at, job: o.job, status: o.status as RunStatus, owner: o.owner };
  if (typeof o.error === 'string') r.error = o.error;
  return r;
}

export function digest(text: string): { rows: DigestRow[]; badLines: number } {
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const r = parseLine(line);
    if (!r) {
      badLines++;
      continue;
    }
    const row = byJob.get(r.job);
    if (!row) {
      byJob.set(r.job, {
        job: r.job,
        owner: r.owner,
        runs: 1,
        retries: r.status === 'retry' ? 1 : 0,
        lastStatus: r.status,
        lastError: r.error ?? null,
        first: r.at,
        last: r.at,
      });
      continue;
    }
    row.runs++;
    if (r.status === 'retry') row.retries++;
    row.lastStatus = r.status;
    if (r.error !== undefined) row.lastError = r.error;
    if (r.owner !== null) row.owner = r.owner;
    row.last = r.at;
  }
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  return { night, ...digest(text) };
};

// Status counts per line for the board: every run, not just the last one per job.
export function nightCounts(runsDir: string, night: string): Record<RunStatus, number> | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const c: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split(/\r?\n/)) {
    const r = line.trim() === '' ? null : parseLine(line);
    if (r) c[r.status]++;
  }
  return c;
}
