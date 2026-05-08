#!/usr/bin/env python3
"""Sync verb translation/conjugations from Cooljugator into verbs_practice.json."""
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent
VERBS_PATH = ROOT / "verbs_practice.json"
BASE_URL = "https://cooljugator.com/lt/{lemma}"

PRONOUN_HEADERS = {"Aš", "Tu", "Jis/ji", "Mes", "Jūs", "Jie/jos", "Translation", "Stress"}
EN_GLOSS_RE = re.compile(
    r"^(I |you |he/she|we |they |you all|to |what |yes,|but |it |the |and |this )",
    re.I,
)


def strip_stress_marks(s: str) -> str:
    # remove lexical stress marks while keeping letters such as ė/ū intact
    stress_ords = {0x300, 0x301, 0x302, 0x303, 0x306, 0x30B, 0x30F, 0x311, 0x341, 0x342}
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if ord(ch) not in stress_ords)
    return unicodedata.normalize("NFC", s)


def fetch_page_lines(lemma: str) -> list[str]:
    url = BASE_URL.format(lemma=urllib.parse.quote(lemma))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
    html = re.sub(r"<script[\s\S]*?</script>", " ", html)
    html = re.sub(r"<style[\s\S]*?</style>", " ", html)
    text = re.sub(r"<[^>]+>", "\n", html)
    text = unescape(text)
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln]


def find_translation(lines: list[str], lemma: str) -> Optional[str]:
    for i, ln in enumerate(lines):
        if ln.lower() == lemma.lower():
            for j in range(i + 1, min(i + 10, len(lines))):
                cand = lines[j].strip()
                if cand.lower().startswith("to "):
                    return cand
            break
    return None


def parse_forms_after_heading(lines: list[str], heading: str, count: int) -> Optional[list[str]]:
    try:
        start = lines.index(heading) + 1
    except ValueError:
        return None
    out: list[str] = []
    for ln in lines[start : start + 80]:
        if ln in PRONOUN_HEADERS:
            continue
        if any(
            ln.startswith(h)
            for h in (
                "Present tense",
                "Past tense",
                "Future tense",
                "Conditional mood",
                "Imperative mood",
                "Past freq. tense",
                "Examples of",
            )
        ):
            break
        if EN_GLOSS_RE.match(ln):
            continue
        if len(ln) <= 1:
            continue
        out.append(strip_stress_marks(ln))
        if len(out) == count:
            return out
    return None


def imperative_to_six(two: Optional[list[str]]) -> Optional[list[str]]:
    if not two or len(two) < 2:
        return None
    return ["", two[0], "", "", two[1], ""]


def sync_entry(entry: dict) -> tuple[bool, str]:
    lemma = str(entry.get("lt") or "").strip()
    if not lemma:
        return False, "no-lemma"
    try:
        lines = fetch_page_lines(lemma)
    except Exception as exc:  # network/timeout
        return False, f"fetch-error:{exc.__class__.__name__}"

    translation = find_translation(lines, lemma)
    present = parse_forms_after_heading(lines, "Present tense", 6)
    past = parse_forms_after_heading(lines, "Past tense", 6)
    future = parse_forms_after_heading(lines, "Future tense", 6)
    conditional = parse_forms_after_heading(lines, "Conditional mood", 6)
    used_to = parse_forms_after_heading(lines, "Past freq. tense", 6)
    imperative_two = parse_forms_after_heading(lines, "Imperative mood", 2)
    imperative = imperative_to_six(imperative_two)

    changed = False
    if translation:
        entry["ru"] = translation
        changed = True
    if present and len(present) == 6:
        entry["present"] = present
        changed = True
    if past and len(past) == 6:
        entry["past"] = past
        changed = True
    if future and len(future) == 6:
        entry["future"] = future
        changed = True
    if conditional and len(conditional) == 6:
        entry["conditional"] = conditional
        changed = True
    if used_to and len(used_to) == 6:
        entry["usedTo"] = used_to
        changed = True
    if imperative and len(imperative) == 6:
        entry["imperative"] = imperative
        changed = True
    return changed, "ok"


def main() -> None:
    verbs = json.loads(VERBS_PATH.read_text(encoding="utf-8"))
    updated = 0
    failed = 0
    for i, entry in enumerate(verbs, start=1):
        changed, status = sync_entry(entry)
        if changed:
            updated += 1
        if status != "ok":
            failed += 1
        if i % 10 == 0:
            print(f"[{i}/{len(verbs)}] updated={updated} failed={failed}")
        time.sleep(0.2)
    VERBS_PATH.write_text(json.dumps(verbs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"done: updated={updated}, failed={failed}, file={VERBS_PATH}")


if __name__ == "__main__":
    main()
