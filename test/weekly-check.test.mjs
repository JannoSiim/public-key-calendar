import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { weekKey, status, begin, finish, fail } from '../scripts/weekly-check.mjs';

const monday = new Date('2026-11-09T10:00:00Z');
const report = { conferences: [{ id: 'crypto', result: 'checked', sources: ['https://crypto.iacr.org/'], note: 'No deadline change.' }], testsPassed: true, buildPassed: true, outcome: 'no-change' };

test('weeks start Monday in Kyiv, including UTC boundary and DST', () => {
  assert.equal(weekKey(new Date('2026-11-08T21:59:00Z')), '2026-11-02');
  assert.equal(weekKey(new Date('2026-11-08T22:01:00Z')), '2026-11-09');
  assert.equal(weekKey(new Date('2026-07-05T21:01:00Z')), '2026-07-06');
});

test('successful no-change check skips rest of week and is due next Monday', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'calendar-week-'));
  try {
    assert.equal((await status(directory, monday)).status, 'due');
    const run = await begin(directory, monday);
    assert.equal((await begin(directory, monday)).status, 'running');
    await finish(run.token, report, ['crypto'], directory, monday);
    assert.equal((await begin(directory, new Date('2026-11-13T15:00:00Z'))).status, 'already-checked');
    assert.equal((await status(directory, new Date('2026-11-16T10:00:00Z'))).status, 'due');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('missing sources and failed checks do not suppress retries; stale runs expire', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'calendar-week-'));
  try {
    const run = await begin(directory, monday);
    await assert.rejects(finish(run.token, report, ['crypto', 'tcc'], directory, monday), /every current conference/);
    await assert.rejects(finish(run.token, { ...report, testsPassed: false }, ['crypto'], directory, monday), /verification/);
    await assert.rejects(fail('wrong-token', directory), /token/);
    await fail(run.token, directory);
    assert.equal((await status(directory, monday)).status, 'due');
    await begin(directory, monday);
    assert.equal((await begin(directory, new Date('2026-11-10T10:00:00Z'))).status, 'started');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
