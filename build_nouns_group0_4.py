#!/usr/bin/env python3
"""Extract nouns from dictt.pdf (all «Группа N» sections) and decline with Lithuanian-nlp-tools."""
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import PyPDF2

ROOT = Path(__file__).resolve().parent
LT_NLP = ROOT / "Lithuanian-nlp-tools"
sys.path.insert(0, str(LT_NLP))
os.chdir(LT_NLP)
from decliner import (  # noqa: E402
    IRREGULAR_NOUNS,
    NOUNS,
    PROPER_NOUNS,
    decline_noun,
)


def strip_lt(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = "".join(
        ch
        for ch in s
        if re.match(r"[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ-]", ch)
    )
    return s.lower()


# Dictionary-style stress marks to strip. Do not remove U+0304 (macron): it distinguishes ū from u in NFD.
_STRESS_ORDS = frozenset(
    [0x0300, 0x0301, 0x0302, 0x0303]  # grave, acute, circumflex, tilde
    + [0x0306, 0x030B, 0x030F, 0x0311, 0x0341, 0x0342]
)


def strip_stress_marks(s: str) -> str:
    """Remove lexical stress marks; keep ą/ę/į etc. (ogonek U+0328 is not removed)."""
    if not s:
        return s
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if ord(ch) not in _STRESS_ORDS)
    return unicodedata.normalize("NFC", s)


def scrub_stress(obj):
    if isinstance(obj, str):
        return strip_stress_marks(obj)
    if isinstance(obj, dict):
        return {k: scrub_stress(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [scrub_stress(x) for x in obj]
    return obj


def clean_ru_gloss(s: str) -> str:
    """Stress-free Russian gloss; drop stray non-Cyrillic symbols from PDF."""
    s = strip_stress_marks(s)
    s = re.sub(r"[\u0F00-\u0FFF]+", "", s)
    return s.strip()


def nfc_lower(s: str) -> str:
    return unicodedata.normalize("NFC", (s or "").strip()).lower()


def decl_ok(d: object) -> bool:
    if not d or not isinstance(d, dict):
        return False
    sg = d.get("Singular")
    return bool(sg and isinstance(sg, dict) and sg.get("Nominative"))


def build_ascii_to_canonical() -> dict[str, str]:
    """Map ASCII-folded lemma -> Lithuanian lemma as in NLP lists (irregulars first)."""
    m: dict[str, str] = {}
    for w in IRREGULAR_NOUNS:
        m.setdefault(strip_lt(w), w)
    for w in NOUNS:
        m.setdefault(strip_lt(w), w)
    for w in PROPER_NOUNS:
        m.setdefault(strip_lt(w), w)
    return m


def _lemma_candidate_strings(lt_main: str, ascii_key: str, cmap: dict[str, str]) -> list[str]:
    """Surface forms worth trying with decline_noun (PDF variants, stress-stripped, comma alternates)."""
    seen: list[str] = []

    def add(s: str) -> None:
        t = (s or "").strip()
        if not t:
            return
        t = nfc_lower(t)
        if t not in seen:
            seen.append(t)

    for part in re.split(r"[,;/]", lt_main or ""):
        part = part.strip()
        if not part:
            continue
        add(part)
        add(strip_stress_marks(part))
    canon = cmap.get(ascii_key)
    if canon:
        add(canon)
        add(strip_stress_marks(canon))
    if ascii_key:
        add(ascii_key)
    return seen


def resolve_lemma_for_decliner(lt_main: str, ascii_key: str, cmap: dict[str, str]) -> str:
    """Prefer PDF spelling, then wordlist canonical form, then ASCII (algorithmic endings)."""
    for cand in _lemma_candidate_strings(lt_main, ascii_key, cmap):
        try:
            d = decline_noun(cand)
        except (KeyError, IndexError, TypeError):
            continue
        if decl_ok(d):
            return cand
    return ascii_key


def extract_nouns_from_pdf(pdf_path: Path) -> tuple[list[dict], list[int]]:
    text = "\n".join(
        (p.extract_text() or "") for p in PyPDF2.PdfReader(str(pdf_path)).pages
    )
    lines = [
        unicodedata.normalize("NFKC", re.sub(r"\s+", " ", ln).strip())
        for ln in text.splitlines()
        if ln.strip()
    ]
    heading_re = re.compile(r"^Группа\s+(\d+)\s*:\s*$")
    allowed = frozenset(
        int(m.group(1)) for ln in lines if (m := heading_re.match(ln))
    )
    pdf_group_ids_sorted = sorted(allowed)
    current_group = None
    in_nouns = False
    out = []
    latin_re = re.compile(r"[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]")

    for ln in lines:
        gm = heading_re.match(ln)
        if gm:
            current_group = int(gm.group(1))
            in_nouns = False
            continue
        if "Существительные" in ln and current_group in allowed:
            in_nouns = True
            continue
        if in_nouns and (
            "Глаголы" in ln
            or "Прилагательные" in ln
            or "Наречия" in ln
            or "Вопросы" in ln
            or "Местоимения" in ln
            or "Числительные" in ln
            or "Предлоги" in ln
            or "Неизменяемые" in ln
            or heading_re.match(ln)
        ):
            in_nouns = False
        if not in_nouns:
            continue
        m = re.match(r"^(\d+)\s+(\d+)\s+(.+)$", ln)
        if not m:
            continue
        rest = m.group(3)
        idx = None
        for i, ch in enumerate(rest):
            if latin_re.match(ch):
                idx = i
                break
        if idx is None:
            continue
        ru = rest[:idx].strip(" -")
        lt_raw = rest[idx:].strip()
        lt_main = re.split(r"[,;]", lt_raw)[0].strip()
        lt_ascii = strip_lt(lt_main)
        if len(lt_ascii) < 2:
            continue
        ru = re.sub(r"\s+", " ", ru)
        out.append({"ru": ru, "lt_main": lt_main, "lt_ascii": lt_ascii, "group": current_group})

    merged: dict[str, dict] = {}
    for row in out:
        k = row["lt_ascii"]
        g = row["group"]
        if k not in merged:
            merged[k] = {
                "ru": row["ru"],
                "lt_main": row["lt_main"],
                "lt_ascii": k,
                "groups": {g},
            }
        else:
            merged[k]["groups"].add(g)
    merged_rows = [
        {**v, "groups": sorted(v["groups"])}
        for v in merged.values()
    ]
    return merged_rows, pdf_group_ids_sorted


def main() -> None:
    pdf_path = ROOT / "dictt.pdf"
    cmap = build_ascii_to_canonical()
    raw, pdf_group_ids = extract_nouns_from_pdf(pdf_path)
    (ROOT / "pdf_group_ids.json").write_text(
        json.dumps(pdf_group_ids, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    result = []
    for row in raw:
        ascii_key = row["lt_ascii"]
        lemma = resolve_lemma_for_decliner(row["lt_main"], ascii_key, cmap)
        try:
            decl = decline_noun(lemma)
        except (KeyError, IndexError, TypeError):
            continue
        if not decl_ok(decl):
            continue
        sg = decl["Singular"]
        if not all(k in sg for k in ("Nominative", "Genitive", "Vocative")):
            continue
        decl = scrub_stress(decl)
        ru_clean = clean_ru_gloss(row["ru"])
        nom = decl["Singular"]["Nominative"]
        result.append(
            {
                "lt": nom,
                "lt_ascii": strip_lt(nom),
                "ru": ru_clean,
                "groups": row["groups"],
                "decl": decl,
            }
        )

    out_path = ROOT / "nouns_group0_4.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    meta_path = ROOT / "pdf_group_ids.json"
    print(
        f"extracted lemmas: {len(raw)}, declined: {len(result)} -> {out_path}; "
        f"pdf groups {pdf_group_ids} -> {meta_path}"
    )


if __name__ == "__main__":
    main()
