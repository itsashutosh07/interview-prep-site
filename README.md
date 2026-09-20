# Switchboard

Mobile-first static site for company tracks (DSA, Backend, LLD, HLD). Progress (checkmarks + notes) is stored in your browser via `localStorage`.

**Default theme:** dark mode.

## Run locally

JSON is loaded with `fetch`, so you need a local HTTP server (opening `index.html` as a file will not work):

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the URL shown (e.g. `http://localhost:3000` or `http://localhost:8080`).

## Deploy

### GitHub Pages (recommended)

Best host for this site: zero build, hash routing, relative paths, and `.nojekyll` already in the repo (needed so Jekyll does not choke on `{{` inside archived C++).

1. Push this repo (private is fine if your plan supports Pages on private repos).
2. **Settings → Pages →** Deploy from branch `main` / root (or `/docs` if you move files there).
3. Site URL will be `https://<user>.github.io/<repo>/` (open with the trailing slash).

Use relative paths (already configured) so project Pages work under a subpath.

### Render

1. New **Static Site** from this repo.
2. Build command: leave empty.
3. Publish directory: `.` (repo root).

Keep the repo/deploy private — the site has no login.

## Progress backup

In a company view, open **⋮** (settings):

- **Export** progress JSON
- **Import** a previous backup
- Clear progress for this company or all companies

## Add another company

1. Copy `data/mmt/` → `data/<slug>/` (e.g. `data/uber/`).
2. Edit the JSON files (`meta.json`, `dsa.json`, `backend.json`, `lld.json`, `hld.json`).
3. Register it in `data/companies.json`:

```json
{
  "id": "uber",
  "slug": "uber",
  "name": "Uber",
  "shortName": "Uber",
  "role": "Backend / SDE-II",
  "accent": "#06c167",
  "description": "…",
  "tabs": ["overview", "dsa", "backend", "lld", "hld", "tips"]
}
```

Question `id` values must stay stable so saved progress keeps matching.

Optional logo fields per company:

```json
"logo": "assets/logos/mmt.png"
```

Shown on the home card, sidebar, top bar, and Overview.

## Content sources

- Primary: `archive/with-answers.html` (solutions + Q&A)
- Gaps filled from: `archive/mmt-prep.html`

Re-extract (optional):

```bash
python3 scripts/extract_content.py
```

Sources are read from `archive/`. After re-extract, re-run backend dedupe if needed (script merges can reintroduce near-duplicates from prep lists).

## Structure

```
index.html
css/styles.css
js/app.js          # routing
js/storage.js      # localStorage
js/render.js       # UI
data/companies.json
data/mmt/*.json
```
