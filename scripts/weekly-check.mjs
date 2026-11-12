import { readFile, writeFile, mkdir, rename, unlink, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
export const stateDirectory = resolve(root, '.calendar-maintenance');
const leaseHours = 6;

export function weekKey(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function status(directory = stateDirectory, now = new Date()) {
  const week = weekKey(now);
  const success = await readJSON(resolve(directory, 'success.json'));
  if (success?.week === week) return { status: 'already-checked', week, completedAt: success.completedAt };
  const lease = await readJSON(resolve(directory, 'lease.json'));
  if (lease && now - new Date(lease.startedAt) < leaseHours * 3600000) {
    return { status: 'running', week, startedAt: lease.startedAt };
  }
  return { status: 'due', week };
}

export async function begin(directory = stateDirectory, now = new Date()) {
  await mkdir(directory, { recursive: true });
  const current = await status(directory, now);
  if (current.status !== 'due') return current;
  const path = resolve(directory, 'lease.json');
  const previous = await readJSON(path);
  if (previous) await unlink(path);
  const lease = { token: randomUUID(), week: current.week, startedAt: now.toISOString() };
  try {
    const handle = await open(path, 'wx');
    try { await handle.writeFile(JSON.stringify(lease, null, 2)); } finally { await handle.close(); }
  } catch (error) {
    if (error.code === 'EEXIST') return { status: 'running', week: current.week };
    throw error;
  }
  return { status: 'started', ...lease };
}

export function validateReport(report, expectedIds) {
  if (!report || !Array.isArray(report.conferences)) throw new Error('A report covering every conference is required.');
  const ids = report.conferences.map(entry => entry.id);
  if (ids.length !== expectedIds.length || new Set(ids).size !== ids.length || expectedIds.some(id => !ids.includes(id))) {
    throw new Error('Report must cover every current conference exactly once.');
  }
  for (const entry of report.conferences) {
    if (!['checked', 'no-announcement'].includes(entry.result) || !entry.note?.trim() || !entry.sources?.length) {
      throw new Error(`Incomplete source check: ${entry.id}`);
    }
    for (const url of entry.sources) if (new URL(url).protocol !== 'https:') throw new Error('HTTPS evidence links required.');
  }
  if (report.testsPassed !== true || report.buildPassed !== true || !['published', 'no-change'].includes(report.outcome)) {
    throw new Error('Successful verification and publication/no-change outcome required.');
  }
  if (report.outcome === 'published' && !/^[a-f0-9]{40}$/.test(report.commit ?? '')) throw new Error('Published commit required.');
}

export async function finish(token, report, expectedIds, directory = stateDirectory, now = new Date()) {
  const lease = await readJSON(resolve(directory, 'lease.json'));
  if (!lease || lease.token !== token) throw new Error('Run token does not match the active check.');
  validateReport(report, expectedIds);
  const record = { week: lease.week, startedAt: lease.startedAt, completedAt: now.toISOString(), report };
  await writeFile(resolve(directory, 'success.tmp.json'), JSON.stringify(record, null, 2) + '\n');
  await rename(resolve(directory, 'success.tmp.json'), resolve(directory, 'success.json'));
  await unlink(resolve(directory, 'lease.json'));
  return { status: 'completed', week: lease.week, outcome: report.outcome };
}

export async function fail(token, directory = stateDirectory) {
  const lease = await readJSON(resolve(directory, 'lease.json'));
  if (!lease || lease.token !== token) throw new Error('Run token does not match the active check.');
  await unlink(resolve(directory, 'lease.json'));
  return { status: 'retry-next-attempt' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command = 'status', token, reportPath] = process.argv.slice(2);
    let result;
    if (command === 'status') result = await status();
    else if (command === 'start') result = await begin();
    else if (command === 'fail') result = await fail(token);
    else if (command === 'finish') {
      const data = await readJSON(resolve(root, 'data/conferences.json'));
      result = await finish(token, await readJSON(resolve(reportPath)), data.conferences.map(c => c.id));
    } else throw new Error('Use status, start, finish TOKEN REPORT, or fail TOKEN.');
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
