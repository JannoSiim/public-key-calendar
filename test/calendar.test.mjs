import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deadlineUrgency, nextEdition, renderRows, upcomingConferences, validateData } from '../src/calendar.mjs';
const data = JSON.parse(await readFile(new URL('../data/conferences.json', import.meta.url), 'utf8'));
const series = id => data.conferences.find(c => c.id === id);

test('urgency uses inclusive 7- and 14-day boundaries and correct wording', () => {
  const today = '2026-11-12';
  for (const [date, level, label] of [
    ['2026-11-12', 'urgent', 'Due today'],
    ['2026-11-13', 'urgent', 'Due in 1 day'],
    ['2026-11-19', 'urgent', 'Due in 7 days'],
    ['2026-11-20', 'soon', 'Due in 8 days'],
    ['2026-11-26', 'soon', 'Due in 14 days']
  ]) assert.deepEqual(deadlineUrgency(date, false, today), { level, label });
  assert.equal(deadlineUrgency('2026-11-27', false, today), null);
  assert.equal(deadlineUrgency('2026-11-11', false, today), null);
  assert.equal(deadlineUrgency('2028-03-01', false, '2028-02-28').label, 'Due in 2 days');
  assert.equal(deadlineUrgency('2026-11-02', false, '2026-10-31').label, 'Due in 2 days');
});

test('estimated urgency is explicitly labeled and rendered hollow', () => {
  const event = nextEdition(series('crypto'), '2027-02-07');
  const html = renderRows([event], '2027-02-07');
  assert.match(html, /deadline-indicator urgent estimated/);
  assert.match(html, /Estimated deadline in 5 days/);
  assert.match(html, /role="tooltip"/);
  assert.match(renderRows([event], '2027-02-12'), /Estimated deadline today/);
  assert.doesNotMatch(renderRows([event], '2027-01-01'), /deadline-indicator/);
  const confirmed = renderRows([nextEdition(series('pqcrypto'), '2026-11-12')], '2026-11-12');
  assert.match(confirmed, /class="deadline-indicator soon"/);
  assert.match(confirmed, /Due in 12 days/);
});

test('default calendar contains only cryptography and CiC, sorted by future paper deadline', () => {
  validateData(data);
  assert.deepEqual(upcomingConferences(data, '2026-11-12').map(c => c.id), [
    'pqcrypto', 'africacrypt', 'acns', 'cic', 'sac', 'crypto', 'itc', 'latincrypt', 'tcc', 'asiacrypt', 'pkc', 'eurocrypt', 'fc', 'scn'
  ]);
});

test('Cybersec and TCS include exactly the selected lists', () => {
  assert.deepEqual(upcomingConferences(data, '2026-11-12', 'cybersec').map(c => c.id), ['sp','pets','eurosp','ccs','usenix','csf']);
  assert.deepEqual(new Set(upcomingConferences(data, '2026-11-12', 'tcs').map(c => c.id)), new Set(['stoc','focs','itcs','ccc','icalp']));
  for (const category of ['cybersec','tcs']) {
    const dates=upcomingConferences(data,'2026-11-12',category).map(c=>c.submission.date);
    assert.deepEqual(dates,[...dates].sort());
  }
});

test('CiC selects the next issue, not the next annual deadline', () => {
  const next=nextEdition(series('cic'),'2026-11-12');
  assert.equal(next.submission.date,'2027-02-02');
  assert.equal(next.status,'estimated');
  assert.equal(next.kind,'journal');
  assert.match(renderRows([next]), /Journal · online/);
  assert.equal(nextEdition(series('cic'),'2027-02-03').submission.date,'2027-05-04');
  assert.equal(nextEdition(series('cic'),'2028-03-01').submission.date,'2028-05-04');
});

test('multiple review cycles roll forward within the same edition', () => {
  assert.equal(nextEdition(series('acns'),'2026-11-12').submission.date,'2027-01-21');
  assert.equal(nextEdition(series('csf'),'2026-11-12').submission.date,'2027-01-28');
  assert.equal(nextEdition(series('sac'),'2027-02-09').submission.date,'2027-05-17');
  assert.equal(nextEdition(series('pets'),'2026-12-01').submission.date,'2027-02-28');
  assert.equal(nextEdition(series('ccs'),'2027-01-15').submission.date,'2027-04-29');
  assert.equal(nextEdition(series('sp'),'2026-11-18').submission.date,'2027-06-11');
});

test('priority highlights follow the requested selections in every category', () => {
  for (const [category,ids] of [['cryptography',['crypto','eurocrypt','asiacrypt','tcc']],['cybersec',['sp','ccs','usenix']],['tcs',['stoc','focs']]]) {
    assert.deepEqual(new Set(upcomingConferences(data,'2026-11-12',category).filter(c=>c.highlight).map(c=>c.id)),new Set(ids));
  }
});
test('an ongoing conference does not retain its closed submissions', () => {
  const event = nextEdition(series('tcc'), '2026-11-12');
  assert.equal(event.year, 2027);
  assert.equal(event.submission.date, '2027-05-19');
  assert.equal(event.status, 'estimated');
  assert.equal(event.country, null);
});
test('deadlines stay on their civil day and roll afterward', () => {
  assert.equal(nextEdition(series('pqcrypto'), '2026-11-24').year, 2027);
  const next = nextEdition(series('pqcrypto'), '2026-11-25');
  assert.equal(next.year, 2028);
  assert.equal(next.submission.date, '2027-11-24');
  assert.equal(next.status, 'estimated');
  assert.equal(next.country, null);
});
test('deadline year and edition year remain distinct in projections', () => {
  const event = nextEdition(series('eurocrypt'), '2026-11-12');
  assert.equal(event.year, 2028);
  assert.equal(event.submission.date, '2027-09-17');
  assert.equal(event.basedOnYear, 2027);
});
test('unannounced deadline can retain an independently confirmed future venue', () => {
  const event = nextEdition(series('asiacrypt'), '2026-11-12');
  assert.equal(event.year, 2027);
  assert.equal(event.submission.date, '2027-05-21');
  assert.equal(event.status, 'estimated');
  assert.equal(event.city, 'Nagoya');
});
test('biennial deadlines skip intervening editions', () => {
  assert.equal(nextEdition(series('scn'), '2026-11-12').submission.date, '2028-03-14');
  assert.equal(nextEdition(series('latincrypt'), '2026-11-12').submission.date, '2027-05-16');
});
test('full-paper deadline, not abstract deadline, controls selection', () => {
  const event = nextEdition(series('pqcrypto'), '2026-11-18');
  assert.equal(event.year, 2027);
  const html = renderRows([event]);
  assert.match(html, /datetime="2026-11-24"/);
  assert.match(html, /Abstract: 17 Nov 2026/);
  assert.doesNotMatch(html, /12–14 May/);
});
test('estimates retain the original baseline and never invent venues', () => {
  const itc = nextEdition(series('itc'), '2026-11-12');
  assert.equal(itc.submission.date, '2027-03-16');
  assert.equal(itc.status, 'estimated');
  assert.equal(itc.country, null);
  assert.equal(itc.linkIsPrevious, true);
  const event = nextEdition(series('crypto'), '2030-12-31');
  assert.equal(event.submission.date, '2031-02-12');
  assert.equal(event.basedOnYear, 2026);
  assert.equal(event.country, null);
  const html = renderRows([event]);
  assert.match(html, /Approx\. 12 Feb 2031/);
  assert.match(html, /Estimated · based on 2026/);
});
test('unsafe text is escaped and external links are safe', () => {
  const html = renderRows([{ ...nextEdition(series('crypto'), '2026-11-12'), name: '<script>alert(1)</script>' }]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /rel="noopener noreferrer"/);
});
test('invalid or missing submission dates block publishing', () => {
  const invalid = structuredClone(data);
  invalid.conferences[0].editions[0].submission.date = '2026-02-30';
  assert.throws(() => validateData(invalid), /Invalid calendar date/);
  delete invalid.conferences[0].editions[0].submission;
  assert.throws(() => validateData(invalid), /Missing paper submission/);
});
