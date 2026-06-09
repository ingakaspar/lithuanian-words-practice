# lithuanian-words-practice

PDF-driven Lithuanian practice app (verbs + noun cases) with:

- data sourced from `dictt.pdf`
- Russian translations in prompts
- left-side nouns/verbs selector
- hint, skip, pronunciation, and answer history
- static hosting support (GitHub Pages)

## Data source

All practice data is generated from:

- `dictt.pdf`

## Build data

```bash
python3 build_all_practice_data.py
```

This generates:

- `verbs_practice.json`
- `nouns_practice.json`

Verb conjugation uses three sources (in `build_practice_data_from_pdf.py`), tried in order:

1. **Lithuanian-nlp-tools** (`Lithuanian-nlp-tools/conjugator.py`) — local open-source rule engine; covers most regular verbs.
2. **Cooljugator** — automatic fallback for irregular verbs the rule engine cannot handle (e.g. `matyti`, `suprasti`, `pamiršti`). Russian gloss stays from the PDF; only forms are taken from Cooljugator.
3. **`MANUAL_CONJUGATIONS`** — hand-checked tables for the last verbs both engines miss (`tęsti`, `geidauti`). Forms verified against morfologija.lietuviuzodynas.lt and zodynas.ru.

Skipped PDF rows that are not real infinitives: `arti` (adverb), `anksti`, `sergantis`, etc.

## Optional: re-sync all verbs from Cooljugator only

```bash
python3 sync_verbs_from_cooljugator.py
```

Overwrites conjugation tables (and may replace `ru` with English glosses from Cooljugator).

## Run locally

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## Pronunciation setup (Google-first)

The `🔊` button uses this order:

1. `TTS_PROXY_URL` from `app-config.js` (if set)
2. Google Translate TTS audio URL fallback (default)

### Minimal setup (no backend)

Keep `app-config.js` as:

```js
window.APP_CONFIG = {
  TTS_PROXY_URL: ""
};
```

No Google account setup is required for this fallback mode.

### Optional setup with your own endpoint

If you have a proxy endpoint, set:

```js
window.APP_CONFIG = {
  TTS_PROXY_URL: "https://<your-endpoint>/api/tts"
};
```

Then rebuild/push as usual.

## Deploy (GitHub Pages)

1. Push the repository to GitHub (`main` branch).
2. In GitHub: `Settings` -> `Pages`
3. Set:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Open:
   - `https://<your-username>.github.io/<repo-name>/`

## Notes

- If UI changes are not visible on Pages, hard-refresh (`Cmd+Shift+R`).
- If you edit `dictt.pdf`, rebuild JSON before pushing.