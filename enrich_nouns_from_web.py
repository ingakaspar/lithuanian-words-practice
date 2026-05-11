#!/usr/bin/env python3
import html
import json
import re
import time
import urllib.parse
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parent
NOUNS_PATH = ROOT / "nouns_practice.json"
USER_AGENT = "website-verbs-enricher/1.0 (local-script)"

WIKI_DEF_URL = "https://en.wiktionary.org/api/rest_v1/page/definition/{word}"
WIKI_WIKITEXT_URL = (
    "https://en.wiktionary.org/w/api.php?action=query&prop=revisions"
    "&rvslots=main&rvprop=content&formatversion=2&format=json&titles={word}"
)
GOOGLE_TRANSLATE_URL = (
    "https://translate.googleapis.com/translate_a/single"
    "?client=gtx&sl=lt&tl=en&dt=t&q={word}"
)

TAG_RE = re.compile(r"<[^>]+>")


def strip_html(s: str) -> str:
    text = TAG_RE.sub("", s or "")
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_json(url: str, session: requests.Session):
    try:
        r = session.get(url, timeout=8)
        if r.status_code != 200:
            return None
        return r.json()
    except Exception:
        return None


def get_en_from_wiktionary(word: str, session: requests.Session):
    url = WIKI_DEF_URL.format(word=urllib.parse.quote(word))
    obj = fetch_json(url, session)
    if not isinstance(obj, dict):
        return None
    lt_entries = obj.get("lt")
    if not isinstance(lt_entries, list):
        return None

    for entry in lt_entries:
        pos = str(entry.get("partOfSpeech") or "").lower()
        if "noun" not in pos:
            continue
        defs = entry.get("definitions") or []
        for d in defs:
            raw = d.get("definition") if isinstance(d, dict) else None
            text = strip_html(raw or "")
            if text:
                return text
    return None


def extract_lithuanian_section(wikitext: str):
    m = re.search(r"==Lithuanian==\n(.*?)(?=\n==[^=]|\Z)", wikitext, flags=re.S)
    return m.group(1) if m else ""


def get_gender_from_wiktionary(word: str, session: requests.Session):
    url = WIKI_WIKITEXT_URL.format(word=urllib.parse.quote(word))
    obj = fetch_json(url, session)
    if not isinstance(obj, dict):
        return None
    pages = (((obj.get("query") or {}).get("pages")) or [])
    if not pages:
        return None
    page = pages[0]
    revs = page.get("revisions") or []
    if not revs:
        return None
    content = ((revs[0].get("slots") or {}).get("main") or {}).get("content")
    if not isinstance(content, str):
        return None

    lt = extract_lithuanian_section(content)
    if not lt:
        return None

    noun_section_match = re.search(r"===Noun===\n(.*?)(?=\n===|\Z)", lt, flags=re.S)
    noun_section = noun_section_match.group(1) if noun_section_match else lt

    # Most reliable for Lithuanian nouns.
    for tpl in re.findall(r"\{\{lt-noun\|([^}]*)\}\}", noun_section):
        params = [p.strip().lower() for p in tpl.split("|")]
        for p in params:
            if p in {"m", "f"}:
                return p
            if p.startswith("g="):
                v = p.split("=", 1)[1].strip()
                if v in {"m", "f"}:
                    return v

    # Fallback for generic head templates.
    for tpl in re.findall(r"\{\{head\|lt\|noun\|([^}]*)\}\}", noun_section):
        params = [p.strip().lower() for p in tpl.split("|")]
        for p in params:
            if p.startswith("g="):
                v = p.split("=", 1)[1].strip()
                if v in {"m", "f"}:
                    return v
            if p in {"m", "f"}:
                return p

    return None


def get_en_from_google(word: str, session: requests.Session):
    url = GOOGLE_TRANSLATE_URL.format(word=urllib.parse.quote(word))
    obj = fetch_json(url, session)
    if not isinstance(obj, list) or not obj or not isinstance(obj[0], list):
        return None
    chunks = []
    for seg in obj[0]:
        if isinstance(seg, list) and seg and isinstance(seg[0], str):
            chunks.append(seg[0])
    out = " ".join(chunks).strip()
    return out or None


def main():
    data = json.loads(NOUNS_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("nouns_practice.json must be a JSON array")

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    total = len(data)
    en_from_wiki = 0
    en_from_google = 0
    gender_from_wiki = 0
    unchanged_gender = 0
    missing_en = 0

    for i, row in enumerate(data, 1):
        word = str((row.get("lt") or "")).strip()
        if not word:
            continue

        en = get_en_from_wiktionary(word, session)
        if en:
            row["en"] = en
            en_from_wiki += 1
        else:
            en2 = get_en_from_google(word, session)
            if en2:
                row["en"] = en2
                en_from_google += 1
            else:
                missing_en += 1

        gender = get_gender_from_wiktionary(word, session)
        if gender in {"m", "f"}:
            row["gender"] = gender
            gender_from_wiki += 1
        else:
            unchanged_gender += 1

        if i % 10 == 0:
            print(f"{i}/{total} processed...")
        time.sleep(0.03)

    NOUNS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Done.")
    print(f"Total: {total}")
    print(f"EN via Wiktionary: {en_from_wiki}")
    print(f"EN via Google fallback: {en_from_google}")
    print(f"Missing EN: {missing_en}")
    print(f"Gender from Wiktionary: {gender_from_wiki}")
    print(f"Gender unchanged (no high-confidence match): {unchanged_gender}")


if __name__ == "__main__":
    main()
