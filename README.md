# Public Key Calendar

A minimal submission-deadline calendar with three category tabs. Cryptography is the default: CRYPTO, EUROCRYPT, ASIACRYPT, TCC, PKC, PQCrypto, Financial Cryptography, LATINCRYPT, SCN, AFRICACRYPT, ACNS, SAC, ITC, and IACR CiC. Cybersec contains IEEE S&P, ACM CCS, USENIX Security, EuroS&P, PETS/PoPETs, and CSF. TCS contains STOC, FOCS, ITCS, CCC, and ICALP.

Each row shows a conference name, full-paper submission deadline, location, and website. The next submission opportunity is selected and sorted by its deadline. Conference dates are not displayed. Editions whose submissions have closed are replaced by the next edition. There are no external fonts, tracking, accounts, API keys, or runtime dependencies.

## Preview locally

Install Node.js 22 or newer, then run:

```sh
npm run dev
```

Open http://127.0.0.1:4173. This builds the page and starts a local preview. After editing source or data, restart the preview to rebuild.

If your Node.js runtime does not include npm, use `node scripts/serve.mjs` for the preview, `node --test` for checks, and `node scripts/build.mjs` for the build. No package installation is needed.

```sh
npm test
npm run build
```

The complete website is generated in `dist/`. Serve that folder, rather than `src/`. The build creates index.html (Cryptography), cybersec.html, and tcs.html. Category links work without JavaScript and do not save the last category: opening the homepage always shows Cryptography. All asset links are relative, so both `username.github.io` and `username.github.io/repository/` work. Conference rows are also rendered into the HTML, so the calendar remains readable without JavaScript. JavaScript updates date selection when the page opens or the date changes.

## Publish on GitHub Pages

1. Create a GitHub repository and upload these project files to its `main` branch.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Open **Actions → Publish GitHub Pages → Run workflow**, or push a change to `main`.
5. The workflow checks the data, builds the static files, and publishes the page. Its deployment result and **Settings → Pages** show the live address.

For GitHub Free, use a public repository. A repository named `YOUR_USERNAME.github.io` publishes at `https://YOUR_USERNAME.github.io/`; other repository names publish beneath `https://YOUR_USERNAME.github.io/REPOSITORY/`. A custom domain can be added later.

No Cloudflare account, API key, or separate server is required. The included workflow runs on pushes and manual requests. It does **not** schedule research or call an AI service.

## Update conference information

Edit `data/conferences.json`. It is the single source of conference data. Update the top-level `updated` date only after checking the sources. Use ISO dates (`YYYY-MM-DD`) and add or update entries inside each conference's `editions` array:

```json
{
  "year": 2027,
  "start": "2027-04-11",
  "end": "2027-04-15",
  "city": "Eindhoven",
  "country": "Netherlands",
  "url": "https://eurocrypt.iacr.org/2027/",
  "status": "confirmed",
  "source": "https://eurocrypt.iacr.org/2027/",
  "submission": {
    "date": "2026-09-17",
    "status": "confirmed",
    "time": "23:59 AoE",
    "source": "https://eurocrypt.iacr.org/2027/"
  }
}
```

- Set category to cryptography, cybersec, or tcs. Set highlight to true for a priority row. The footer links to Janno Siim and displays the data file's updated date.
- An edition may provide a submissions array for multiple review cycles or journal issues. The next still-upcoming full-paper deadline is selected. Once all saved rounds end, the last confirmed edition's cycles are projected into the next year; never replace several rounds with one annual deadline. CiC uses kind: journal and null event dates; its location reads Journal · online.
- Each edition must include a submission object with its full-paper deadline date, status, and source. Abstract registration is separate (abstractDate) and does not determine sorting. Cutoff times can be recorded in time when verified.
- Submission status is independent of conference-date status. A venue can be confirmed while its submission deadline remains estimated.
- Explicit estimated deadlines use submission.status = "estimated" and submission.basedOnYear = the baseline conference edition year.
- If no future submission opportunity is saved, project the last confirmed submission deadline using the series cycle and label it Approx. and Estimated · based on YEAR.
- Preserve the offset between deadline year and edition year. EUROCRYPT 2027 had a September 2026 deadline; the estimate for EUROCRYPT 2028 is September 2027.
- LATINCRYPT and SCN use two-year cycles. The other eight use one-year cycles.
- Estimates are planning approximations. Update them when announced. Do not infer cutoff times, venues, or new website addresses.
- Generated future editions show To be announced for location and link to the last saved organizer site as Last edition. Saved future editions can retain independently confirmed venues.
- Dates roll over on the following civil day in the visitor's timezone. Exact cutoff times are informational; the organizer's submission system is authoritative.

For a future Dot task, give it this repository and ask it to check the sources, edit this data file, run the checks, and push verified updates. GitHub Pages will publish them through the existing workflow. A GitHub workflow that commits with `GITHUB_TOKEN` should deploy Pages in the same workflow or explicitly trigger the deployment: its commit does not automatically start another push-triggered GitHub workflow.

## Files

- `data/conferences.json` — conference records and source links.
- `src/index.html` and `src/styles.css` — page layout and styling.
- `src/calendar.mjs` — date selection, estimates, formatting, and validation.
- `src/categories.mjs` — category labels, static page names, and navigation.
- `src/app.mjs` — browser date refresh; no network requests or AI calls.
- `scripts/build.mjs` — creates the standalone static site.
- `.github/workflows/pages.yml` — checks, builds, and publishes to GitHub Pages.
- `SOURCES.md` — verification notes and baseline dates.

For a reproducible build or a future-date preview, set the `CALENDAR_DATE` environment variable to an ISO date before running `npm run build`. Browser JavaScript uses the visitor's current local date.
