# lithuanian-words-practice

Workbook-driven Lithuanian practice app (verbs + noun cases).

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

## Run locally

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.