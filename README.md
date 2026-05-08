# lithuanian-words-practice

Workbook-driven Lithuanian practice app (verbs + noun cases) with:

- multi-select Tier filters
- multi-select Topic filters
- hint, skip, pronunciation, and answer history
- static hosting support (GitHub Pages)

## Data source

All practice data is generated from:

- `words.xlsx` (sheet: `📝 Vocabulary Test`)

No PDF pipeline is used.

## Build data

```bash
python3 build_all_practice_data.py
```

This generates:

- `verbs_practice.json`
- `nouns_practice.json`
- `word_groups.json`
- `word_topics.json`
- `translation_cache.json` (auto-translation cache for missing EN cells)

## Optional: sync verbs from Cooljugator

If you want to refresh verb conjugation tables/translations from Cooljugator:

```bash
python3 sync_verbs_from_cooljugator.py
```

This updates `verbs_practice.json`.

## Run locally

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

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

- Topic/Tier selectors use localStorage to remember your choices.
- If UI changes are not visible on Pages, hard-refresh (`Cmd+Shift+R`).
- If you edit `words.xlsx`, rebuild JSON before pushing.