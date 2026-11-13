import { renderRows, todayISO, upcomingConferences } from './calendar.mjs';

const data = JSON.parse(document.getElementById('conference-data').textContent);
const list = document.getElementById('conference-list');
const category = document.body.dataset.category;
let displayedDay;

function refresh() {
  const today = todayISO();
  if (today === displayedDay) return;
  list.innerHTML = renderRows(upcomingConferences(data, today, category), today, data.beerPrices);
  displayedDay = today;
}

refresh();
// Refresh civil-date selection after midnight or when a sleeping tab becomes visible.
setInterval(refresh, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

function closeDetails() {
  list.querySelectorAll('.detail-trigger').forEach(button => button.setAttribute('aria-expanded', 'false'));
}

document.addEventListener('click', event => {
  if (event.target.closest('.detail-tooltip')) return;
  const button = event.target.closest('.detail-trigger');
  const opening = button?.getAttribute('aria-expanded') !== 'true';
  closeDetails();
  list.querySelectorAll('.detail-hover').forEach(range => range.classList.add('tooltip-dismissed'));
  if (button) {
    button.setAttribute('aria-expanded', String(opening));
    button.parentElement.classList.toggle('tooltip-dismissed', !opening);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeDetails();
    list.querySelectorAll('.detail-hover').forEach(range => range.classList.add('tooltip-dismissed'));
  }
});
list.addEventListener('pointerover', event => {
  const range = event.target.closest('.detail-hover');
  if (range && !range.contains(event.relatedTarget)) range.classList.remove('tooltip-dismissed');
});
list.addEventListener('focusin', event => event.target.closest('.detail-hover')?.classList.remove('tooltip-dismissed'));
list.addEventListener('focusout', event => {
  const range = event.target.closest('.detail-hover');
  if (range && !range.contains(event.relatedTarget)) closeDetails();
});
