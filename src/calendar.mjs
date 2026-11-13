const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

export function todayISO(date = new Date()) {
  // Compare civil dates, not midnight timestamps, to keep an event's last day visible.
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function parseDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!datePattern.test(value) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

function validateURL(value) {
  if (new URL(value).protocol !== 'https:') throw new Error(`Use an HTTPS source or conference link: ${value}`);
}

export function validateData(data) {
  parseDate(data.updated);
  if (!data.conferences.length) throw new Error('The calendar must contain conferences.');
  const ids = new Set();
  for (const conference of data.conferences) {
    if (!conference.id || ids.has(conference.id)) throw new Error('Conference IDs must be present and unique.');
    ids.add(conference.id);
    if (!['cryptography', 'cybersec', 'tcs'].includes(conference.category)) throw new Error(`Invalid category: ${conference.id}`);
    if (!conference.name || ![1, 2].includes(conference.intervalYears)) throw new Error(`Invalid series: ${conference.id}`);
    validateURL(conference.website);
    if (!conference.editions?.length) throw new Error(`No editions for ${conference.id}`);
    const years = new Set();
    for (const edition of conference.editions) {
      if (conference.kind !== 'journal') {
        parseDate(edition.start);
        parseDate(edition.end);
      }
      if ((conference.kind !== 'journal' && (edition.start > edition.end || Number(edition.start.slice(0, 4)) !== edition.year)) || years.has(edition.year)) {
        throw new Error(`Invalid date range or duplicate edition for ${conference.id}`);
      }
      years.add(edition.year);
      if (!['confirmed', 'estimated'].includes(edition.status)) throw new Error(`Invalid status for ${conference.id}`);
      if (edition.status === 'estimated' && (!Number.isInteger(edition.basedOnYear) || edition.basedOnYear >= edition.year)) {
        throw new Error(`Estimated dates need a prior baseline year: ${conference.id}`);
      }
      validateURL(edition.url);
      validateURL(edition.source);
      if (edition.locationSource) validateURL(edition.locationSource);
      const submissions = edition.submissions ?? [edition.submission];
      if (!submissions.length || submissions.some(s => !s)) throw new Error(`Missing paper submission deadline: ${conference.id}`);
      const dates = new Set();
      for (const submission of submissions) {
      parseDate(submission.date);
      validateURL(submission.source);
      if (!['confirmed', 'estimated'].includes(submission.status)) throw new Error(`Invalid submission status: ${conference.id}`);
      if (submission.status === 'estimated' && (!Number.isInteger(submission.basedOnYear) || submission.basedOnYear >= edition.year)) {
        throw new Error(`Estimated submission deadlines need a baseline edition: ${conference.id}`);
      }
      if (dates.has(submission.date)) throw new Error(`Duplicate submission round: ${conference.id}`);
      dates.add(submission.date);
      if (edition.start && submission.date > edition.start) throw new Error(`Submission must precede the conference: ${conference.id}`);
      if (submission.abstractDate) {
        parseDate(submission.abstractDate);
        if (submission.abstractDate > submission.date) throw new Error(`Abstract registration must precede the paper deadline: ${conference.id}`);
      }
      }
    }
  }
  return data;
}

function shiftDate(value, year) {
  const original = parseDate(value);
  const month = original.getUTCMonth();
  const day = Math.min(original.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function nextEdition(conference, today = todayISO()) {
  parseDate(today);
  const metadata = { id: conference.id, name: conference.name, kind: conference.kind, highlight: conference.highlight };
  const editions = conference.editions.flatMap(edition => (edition.submissions ?? [edition.submission]).map(submission => ({...edition, submission})))
    .sort((a, b) => a.submission.date.localeCompare(b.submission.date));
  const announced = editions.find(edition => edition.submission.date >= today);
  if (announced) return { ...announced, ...metadata, eventStatus: announced.status, eventBasedOnYear: announced.basedOnYear, status: announced.submission.status, basedOnYear: announced.submission.basedOnYear };

  // Use the last confirmed edition, never compound an earlier estimate.
  const confirmed = editions.filter(edition => edition.submission.status === 'confirmed');
  const lastYear = Math.max(...(confirmed.length ? confirmed : editions).map(edition => edition.year));
  const baselines = (confirmed.length ? confirmed : editions).filter(edition => edition.year === lastYear);
  // Project every review cycle, then choose the nearest one; journals may have four per year.
  return baselines.map(baseline => {
  const baselineYear = baseline.submission.basedOnYear ?? baseline.year;
  let year = baseline.year + conference.intervalYears;
  // A submission deadline can fall in the year BEFORE the conference edition.
  const deadlineYear = Number(baseline.submission.date.slice(0, 4));
  while (shiftDate(baseline.submission.date, deadlineYear + year - baseline.year) < today) year += conference.intervalYears;
  const start = baseline.start ? shiftDate(baseline.start, year) : null;
  const end = baseline.end ? shiftDate(baseline.end, year) : null;
  return {
    ...metadata, year, start, end,
    status: 'estimated', basedOnYear: baselineYear,
    eventStatus: 'estimated', eventBasedOnYear: baseline.basedOnYear ?? baseline.year,
    city: null, country: null,
    url: baseline.url, linkIsPrevious: true,
    source: baseline.source,
    submission: {
      date: shiftDate(baseline.submission.date, deadlineYear + year - baseline.year),
      status: 'estimated', basedOnYear: baselineYear, source: baseline.submission.source, label: baseline.submission.label
    }
  };
  }).sort((a,b) => a.submission.date.localeCompare(b.submission.date))[0];
}

export function upcomingConferences(data, today = todayISO(), category = 'cryptography') {
  return data.conferences.filter(conference => conference.category === category).map(conference => nextEdition(conference, today))
    .sort((a, b) => a.submission.date.localeCompare(b.submission.date) || a.name.localeCompare(b.name));
}

export function formatDateRange(start, end) {
  const first = parseDate(start);
  const last = parseDate(end);
  const firstMonth = monthFormat.format(first);
  const lastMonth = monthFormat.format(last);
  if (start === end) return `${first.getUTCDate()} ${firstMonth} ${first.getUTCFullYear()}`;
  if (first.getUTCFullYear() !== last.getUTCFullYear()) {
    return `${first.getUTCDate()} ${firstMonth} ${first.getUTCFullYear()} – ${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
  }
  if (firstMonth !== lastMonth) return `${first.getUTCDate()} ${firstMonth} – ${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
  return `${first.getUTCDate()}–${last.getUTCDate()} ${lastMonth} ${last.getUTCFullYear()}`;
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function deadlineUrgency(date, estimated = false, today = todayISO()) {
  const days = Math.round((parseDate(date) - parseDate(today)) / 86_400_000);
  if (days < 0 || days > 14) return null;
  const when = days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`;
  return { level: days <= 7 ? 'urgent' : 'soon', label: `${estimated ? 'Estimated deadline' : 'Due'} ${when}` };
}

export function validateBeerPrices(prices) {
  const locations = new Set();
  for (const price of prices) {
    const key = `${price.city}|${price.country}`;
    if (!price.city || !price.country || locations.has(key) || !Number.isFinite(price.eur) || price.eur <= 0) throw new Error('Invalid or duplicate city beer price');
    locations.add(key);
    parseDate(price.checked);
    validateURL(price.source);
  }
  return prices;
}

function eventDetails(conference) {
  if (conference.kind === 'journal') return 'Journal publication · no conference dates';
  if (!conference.start || !conference.end) return 'Conference dates to be announced';
  const dates = formatDateRange(conference.start, conference.end);
  return conference.eventStatus === 'estimated'
    ? `Conference: approx. ${dates} · based on ${conference.eventBasedOnYear}`
    : `Conference: ${dates}`;
}

export function renderRows(conferences, today = todayISO(), beerPrices = []) {
  return conferences.map(conference => {
    const estimated = conference.status === 'estimated';
    const locationName = [conference.city, conference.country].filter(Boolean).join(', ');
    const location = conference.kind === 'journal' ? 'Journal · online' : locationName
      ? `${locationName}${conference.locationStatus === 'expected' ? ' (expected)' : ''}` : 'To be announced';
    const date = conference.submission.date;
    const urgency = deadlineUrgency(date, estimated, today);
    const tooltipId = `deadline-tip-${conference.id}`;
    const indicator = urgency ? `<span class="deadline-indicator ${urgency.level}${estimated ? ' estimated' : ''}" aria-hidden="true"><span class="deadline-dot"></span></span>` : '';
    const deadlineDetails = `${urgency ? `<span class="tooltip-heading">${escapeHTML(urgency.label)}</span>` : ''}${escapeHTML(eventDetails(conference))}`;
    const beer = beerPrices.find(price => price.city === conference.city && price.country === conference.country);
    const beerDetails = beer
      ? `<span class="tooltip-heading">Beer ≈ €${beer.eur.toFixed(2)}</span>Average domestic draught · 0.5 L<br>At a bar or restaurant<span class="tooltip-source"><a href="${escapeHTML(beer.source)}" target="_blank" rel="noopener noreferrer">Numbeo ↗</a> · checked ${formatDateRange(beer.checked, beer.checked)}</span>`
      : conference.kind === 'journal' ? 'Online journal · no conference location'
      : !conference.city ? 'Beer price available once the city is announced'
      : 'City beer-price estimate unavailable';
    const dateLabel = `${estimated ? 'Approx. ' : ''}${formatDateRange(date, date)}`;
    const note = estimated
      ? `<span class="date-note">Estimated · based on ${conference.basedOnYear}</span>`
      : `<span class="date-note deadline-detail">${[conference.submission.time, conference.submission.abstractDate ? `Abstract: ${formatDateRange(conference.submission.abstractDate, conference.submission.abstractDate)}` : conference.submission.label].filter(Boolean).map(escapeHTML).join(' · ')}</span>`;
    const linkLabel = conference.linkIsPrevious ? 'Last edition' : 'Website';
    return `<tr${conference.highlight ? ' class="highlighted"' : ''} data-conference="${escapeHTML(conference.id)}" data-deadline="${date}" data-status="${conference.status}">
      <th scope="row"><span class="conference-name">${escapeHTML(conference.name)}</span><span class="edition-year">${conference.year}</span></th>
      <td class="dates"><span class="date-range detail-hover"><button type="button" class="detail-trigger" aria-describedby="${escapeHTML(tooltipId)}" aria-expanded="false">${indicator}<time datetime="${date}">${escapeHTML(dateLabel)}</time></button><span class="detail-tooltip deadline-tooltip" role="tooltip" id="${escapeHTML(tooltipId)}">${deadlineDetails}</span></span>${note}</td>
      <td class="location${!conference.country ? ' unannounced' : ''}"><span class="detail-hover"><button type="button" class="detail-trigger" aria-describedby="beer-tip-${escapeHTML(conference.id)}" aria-expanded="false">${escapeHTML(location)}</button><span class="detail-tooltip beer-tooltip" role="tooltip" id="beer-tip-${escapeHTML(conference.id)}">${beerDetails}</span></span></td>
      <td class="website"><a href="${escapeHTML(conference.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(conference.name)} ${conference.year}: ${linkLabel.toLowerCase()} (opens in a new tab)">${linkLabel}<span class="external-arrow" aria-hidden="true">↗</span></a></td>
    </tr>`;
  }).join('\n');
}
