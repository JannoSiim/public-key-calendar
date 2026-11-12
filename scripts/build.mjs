import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { formatDateRange, renderRows, todayISO, upcomingConferences, validateData } from '../src/calendar.mjs';
import { categories, renderTabs } from '../src/categories.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const data = validateData(JSON.parse(await readFile(resolve(root, 'data/conferences.json'), 'utf8')));
const today = process.env.CALENDAR_DATE ?? todayISO();
const template = await readFile(resolve(root, 'src/index.html'), 'utf8');
await mkdir(output, { recursive: true });
for (const category of categories) {
const rows = upcomingConferences(data, today, category.id);
const html = template
  .replace('<!-- CATEGORY_ID -->', category.id)
  .replace('<!-- SUBTITLE -->', category.subtitle)
  .replace('<!-- CATEGORY_TABS -->', renderTabs(category.id))
  .replace('<!-- UPDATED_ISO -->', data.updated)
  .replace('<!-- UPDATED_LABEL -->', formatDateRange(data.updated, data.updated))
  .replace('<!-- CONFERENCE_ROWS -->', renderRows(rows, today))
  .replace('<!-- CONFERENCE_DATA -->', JSON.stringify(data).replaceAll('<', '\\u003c'));
await writeFile(resolve(output, category.file), html);
}
await writeFile(resolve(output, '.nojekyll'), '');
for (const file of ['styles.css', 'app.mjs', 'calendar.mjs', 'favicon.svg']) {
  await copyFile(resolve(root, 'src', file), resolve(output, file));
}
console.log(`Built ${data.conferences.length} venues across ${categories.length} calendars into dist/ (calendar date: ${today}).`);
