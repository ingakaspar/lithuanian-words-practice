#!/usr/bin/env python3
"""Build nouns + verbs JSON for the app from dictt.pdf."""
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Optional

from PyPDF2 import PdfReader

ROOT = Path(__file__).resolve().parent
LT_NLP = ROOT / "Lithuanian-nlp-tools"
sys.path.insert(0, str(LT_NLP))
os.chdir(LT_NLP)
from conjugator import conjugate  # noqa: E402
from decliner import decline_noun  # noqa: E402

sys.path.insert(0, str(ROOT))
import sync_verbs_from_cooljugator as cooljugator  # noqa: E402

# PDF OCR / tagging mistakes — not infinitives for the conjugator.
SKIP_LT_ASCII = frozenset({"arti", "anksti", "sergantis"})
# Map broken PDF lemmas to the form open-source conjugators expect.
LEMMA_ALIASES = {"gržti": "grįžti", "grzti": "grįžti"}

# Hand-checked tables for verbs both the local rules and Cooljugator miss.
# Sources: morfologija.lietuviuzodynas.lt and zodynas.ru (see README).
MANUAL_CONJUGATIONS = {
    "testi": {
        "present": ["tęsiu", "tęsi", "tęsia", "tęsiame", "tęsiate", "tęsia"],
        "past": ["tęsiau", "tęsei", "tęsė", "tęsėme", "tęsėte", "tęsė"],
        "future": ["tęsiu", "tęsi", "tęs", "tęsime", "tęsite", "tęs"],
        "usedTo": ["tęsdavau", "tęsdavai", "tęsdavo", "tęsdavome", "tęsdavote", "tęsdavo"],
        "conditional": ["tęsčiau", "tęstum(ei)", "tęstų", "tęstu(mė)me", "tęstu(mė)te", "tęstų"],
        "imperative": ["", "tęsk", "", "tęskime", "tęskite", ""],
    },
    "geidauti": {
        "present": ["geidauju", "geidauji", "geidauja", "geidaujame", "geidaujate", "geidauja"],
        "past": ["geidavau", "geidavai", "geidavo", "geidavome", "geidavote", "geidavo"],
        "future": ["geidausiu", "geidausi", "geidaus", "geidausime", "geidausite", "geidaus"],
        "usedTo": ["geidaudavau", "geidaudavai", "geidaudavo", "geidaudavome", "geidaudavote", "geidaudavo"],
        "conditional": ["geidaučiau", "geidautum(ei)", "geidautų", "geidautu(mė)me", "geidautu(mė)te", "geidautų"],
        "imperative": ["", "geidauk", "", "geidaukime", "geidaukite", ""],
    },
}

PDF_PATH = ROOT / "dictt.pdf"

_STRESS_ORDS = frozenset(
    [0x0300, 0x0301, 0x0302, 0x0303] + [0x0306, 0x030B, 0x030F, 0x0311, 0x0341, 0x0342]
)
_MEANINGS_5 = [
    "first person singular",
    "second person singular",
    "third person",
    "first person plural",
    "second person plural",
]
_LT_CHAR_RE = re.compile(r"[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]")
_NON_LT_WORD_RE = re.compile(r"[^A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž\s\-]")


def strip_stress_marks(s: str) -> str:
    if not s:
        return s
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if ord(ch) not in _STRESS_ORDS)
    return unicodedata.normalize("NFC", s)


def strip_lt(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = "".join(ch for ch in s if re.match(r"[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ-]", ch))
    return s.lower()


def tense_six(d: object) -> list:
    if not isinstance(d, dict):
        return ["", "", "", "", "", ""]
    vals = [(d.get(k) or "").strip() for k in _MEANINGS_5]
    third = vals[2]
    return [vals[0], vals[1], third, vals[3], vals[4], third]


def conditional_six(d: object) -> list:
    return tense_six(d)


def imperative_six(d: object) -> list:
    if not isinstance(d, dict):
        return ["", "", "", "", "", ""]
    return [
        "",
        (d.get("second person singular") or "").strip(),
        "",
        (d.get("first person plural") or "").strip(),
        (d.get("second person plural") or "").strip(),
        "",
    ]


def scrub_stress(obj):
    if isinstance(obj, str):
        return strip_stress_marks(obj)
    if isinstance(obj, dict):
        return {k: scrub_stress(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [scrub_stress(x) for x in obj]
    return obj


def decl_ok(d: object) -> bool:
    if not d or not isinstance(d, dict):
        return False
    sg = d.get("Singular")
    return bool(sg and isinstance(sg, dict) and sg.get("Nominative"))


def conjugate_open_source(lt: str) -> Optional[dict]:
    """Lithuanian-nlp-tools rule conjugator (local, open source)."""
    try:
        c = conjugate(lt)
    except (KeyError, IndexError, TypeError, ValueError):
        return None
    present = c.get("present") or {}
    if not (present.get("third person") or "").strip():
        return None
    return c


def conjugate_cooljugator(lt: str) -> Optional[dict]:
    """Fallback web conjugator when local rules fail (irregular verbs)."""
    scratch = {"lt": lt}
    try:
        changed, _status = cooljugator.sync_entry(scratch)
    except Exception:
        return None
    if not changed or not scratch.get("present"):
        return None
    return scratch


def verb_entry_from_conjugation(
    lt: str, lt_ascii: str, ru: str, groups: set, conj: dict, *, source: str
) -> dict:
    if source == "nlp-tools":
        return {
            "lt": lt,
            "lt_ascii": lt_ascii,
            "ru": ru,
            "groups": sorted(groups),
            "present": tense_six(conj.get("present")),
            "past": tense_six(conj.get("past")),
            "future": tense_six(conj.get("future")),
            "usedTo": tense_six(conj.get("past iterative")),
            "participlePastMasc": "",
            "conditional": conditional_six(conj.get("conditional")),
            "imperative": imperative_six(conj.get("imperative")),
        }
    return {
        "lt": lt,
        "lt_ascii": lt_ascii,
        "ru": ru,
        "groups": sorted(groups),
        "present": conj.get("present") or ["", "", "", "", "", ""],
        "past": conj.get("past") or ["", "", "", "", "", ""],
        "future": conj.get("future") or ["", "", "", "", "", ""],
        "usedTo": conj.get("usedTo") or ["", "", "", "", "", ""],
        "participlePastMasc": "",
        "conditional": conj.get("conditional") or ["", "", "", "", "", ""],
        "imperative": conj.get("imperative") or ["", "", "", "", "", ""],
    }


def clean_lt_word(raw: str) -> str:
    s = strip_stress_marks(str(raw or "").strip())
    s = re.split(r"[,;/]", s)[0].strip()
    s = re.sub(r"\([^)]*\)", "", s).strip()
    s = _NON_LT_WORD_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_dictionary_rows() -> list[dict]:
    reader = PdfReader(str(PDF_PATH))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    lines = [unicodedata.normalize("NFKC", x).strip() for x in text.splitlines()]

    rows = []
    current_group = None
    current_section = None

    for line in lines:
        if not line:
            continue
        gm = re.match(r"^Группа\s+(\d+)\s*:", line)
        if gm:
            current_group = int(gm.group(1))
            current_section = None
            continue
        if current_group is None:
            continue

        if "Глаголы" in line:
            current_section = "verb"
            continue
        if "Существительные" in line:
            current_section = "noun"
            continue
        if current_section not in {"verb", "noun"}:
            continue
        if re.search(r"Перевод|Комментарий|Прилагательные|Наречия|Вопросы|Числительные|Предлоги|Местоимения|Неизменяемые", line):
            continue

        raw = re.sub(r"^\d+\s+\d+\s+", "", line).strip()
        if not raw:
            continue
        tokens = raw.split()
        if len(tokens) < 2:
            continue

        lt_start = None
        for i, token in enumerate(tokens):
            if _LT_CHAR_RE.search(token):
                lt_start = i
                break
        if lt_start is None or lt_start == 0:
            continue

        ru = " ".join(tokens[:lt_start]).strip(" ,;")
        lt = clean_lt_word(" ".join(tokens[lt_start:]))
        lt_ascii = strip_lt(lt)
        if not ru or not lt or len(lt_ascii) < 2:
            continue

        rows.append(
            {
                "lt": lt,
                "lt_ascii": lt_ascii,
                "ru": ru,
                "group": current_group,
                "section": current_section,
            }
        )
    return rows


def build_verbs(rows: list[dict]) -> list[dict]:
    merged = {}
    for r in rows:
        if r["section"] != "verb":
            continue
        key = r["lt_ascii"]
        if key not in merged:
            merged[key] = {"lt": r["lt"], "lt_ascii": key, "ru": r["ru"], "groups": {r["group"]}}
        else:
            merged[key]["groups"].add(r["group"])

    out = []
    nlp_n = cool_n = manual_n = 0
    for v in merged.values():
        lt_ascii = v["lt_ascii"]
        if lt_ascii in SKIP_LT_ASCII:
            continue
        lt = LEMMA_ALIASES.get(v["lt"], LEMMA_ALIASES.get(lt_ascii, v["lt"]))
        if not (lt.endswith("ti") or lt.endswith("tis")):
            continue

        conj = conjugate_open_source(lt)
        source = "nlp-tools"
        if not conj:
            conj = conjugate_cooljugator(lt)
            source = "cooljugator"
            time.sleep(0.25)
        if not conj:
            manual = MANUAL_CONJUGATIONS.get(strip_lt(lt))
            if manual:
                conj = dict(manual)
                source = "manual"
        if not conj:
            continue

        entry_lt_ascii = strip_lt(lt)
        out.append(
            verb_entry_from_conjugation(
                lt, entry_lt_ascii, v["ru"], v["groups"], conj, source=source
            )
        )
        if source == "nlp-tools":
            nlp_n += 1
        elif source == "manual":
            manual_n += 1
        else:
            cool_n += 1
    out.sort(key=lambda x: x["lt_ascii"])
    print(
        f"verbs: {len(out)} total ({nlp_n} nlp-tools, "
        f"{cool_n} cooljugator fallback, {manual_n} manual)"
    )
    return out


def build_nouns(rows: list[dict]) -> list[dict]:
    merged = {}
    for r in rows:
        if r["section"] != "noun":
            continue
        key = r["lt_ascii"]
        if key not in merged:
            merged[key] = {"lt": r["lt"], "lt_ascii": key, "ru": r["ru"], "groups": {r["group"]}}
        else:
            merged[key]["groups"].add(r["group"])

    out = []
    for n in merged.values():
        try:
            decl = decline_noun(n["lt"])
        except (KeyError, IndexError, TypeError):
            continue
        if not decl_ok(decl):
            continue
        sg = decl["Singular"]
        if not all(k in sg for k in ("Nominative", "Genitive", "Vocative")):
            continue
        nom = strip_stress_marks(str(sg["Nominative"]))
        out.append(
            {
                "lt": nom,
                "lt_ascii": strip_lt(nom),
                "ru": n["ru"],
                "groups": sorted(n["groups"]),
                "decl": scrub_stress(decl),
            }
        )
    out.sort(key=lambda x: x["lt_ascii"])
    return out


def main() -> None:
    if not PDF_PATH.exists():
        raise FileNotFoundError(f"Missing input file: {PDF_PATH}")
    rows = parse_dictionary_rows()
    verbs = build_verbs(rows)
    nouns = build_nouns(rows)
    verbs_path = ROOT / "verbs_practice.json"
    nouns_path = ROOT / "nouns_practice.json"
    stats_path = ROOT / "pdf_stats.json"
    verbs_path.write_text(json.dumps(verbs, ensure_ascii=False, indent=2), encoding="utf-8")
    nouns_path.write_text(json.dumps(nouns, ensure_ascii=False, indent=2), encoding="utf-8")
    group_counts = {}
    for g in sorted({int(r["group"]) for r in rows}):
        group_counts[str(g)] = {
            "nouns_raw": sum(1 for r in rows if r["group"] == g and r["section"] == "noun"),
            "verbs_raw": sum(1 for r in rows if r["group"] == g and r["section"] == "verb"),
            "nouns_included": sum(1 for n in nouns if g in (n.get("groups") or [])),
            "verbs_included": sum(1 for v in verbs if g in (v.get("groups") or [])),
        }
    stats = {
        "rows_total": len(rows),
        "nouns_raw": sum(1 for r in rows if r["section"] == "noun"),
        "verbs_raw": sum(1 for r in rows if r["section"] == "verb"),
        "nouns_included": len(nouns),
        "verbs_included": len(verbs),
        "group_counts": group_counts,
    }
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"dictt rows: {len(rows)} -> verbs: {len(verbs)} ({verbs_path}), "
        f"nouns: {len(nouns)} ({nouns_path}), stats: {stats_path}"
    )


if __name__ == "__main__":
    main()
