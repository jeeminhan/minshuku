#!/usr/bin/env python3
"""Combine /tmp/jlpt-sources.json + /tmp/enrich-*.json into data/vocab.json + data/grammar.json.

Enrichment files (one per level + type):
  /tmp/enrich-{LEVEL}-vocab.json   array of {partOfSpeech, scenarioTags, exampleSentences} in same order as sources
  /tmp/enrich-{LEVEL}-grammar.json array of {meaning, formation, scenarioTags, exampleSentences, commonMistakes?}

Sources file structure:
  {"vocab": {"N5": [...], ...}, "grammar": {"N5": [...], ...}}
"""
import json, re, sys
from pathlib import Path

LEVELS = ["N5", "N4", "N3", "N2", "N1"]
SRC = json.load(open("/tmp/jlpt-sources.json"))
OUT_DIR = Path(__file__).parent.parent / "data"

def slugify_romaji(r: str) -> str:
    s = r.lower()
    for a, b in [("ā","aa"),("ī","ii"),("ū","uu"),("ē","ee"),("ō","ou")]:
        s = s.replace(a, b)
    s = s.split("・")[0]
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

KANA = {
    "あ":"a","い":"i","う":"u","え":"e","お":"o",
    "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
    "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
    "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
    "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
    "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
    "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
    "や":"ya","ゆ":"yu","よ":"yo",
    "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
    "わ":"wa","を":"wo","ん":"n",
    "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
    "ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
    "だ":"da","で":"de","ど":"do",
    "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
    "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
}

def hira_to_romaji(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", "".join(KANA.get(c, c) for c in s))

def clean_ja(s: str) -> str:
    if not s: return s
    s = re.sub(r"[△▲]", "", s)
    s = s.replace("\r", "")
    return s.strip()

def build_vocab_id(level: str, src: dict) -> str:
    slug = (
        slugify_romaji(src.get("romaji","")) or
        slugify_romaji(hira_to_romaji(src.get("furigana",""))) or
        slugify_romaji(src.get("word",""))
    )
    return f"vocab.{level.lower()}.{slug}"

def assemble_vocab(level: str, src: dict, enr: dict) -> dict:
    reading = (src.get("furigana") or "").strip() or src["word"]
    return {
        "id": build_vocab_id(level, src),
        "word": src["word"],
        "reading": reading,
        "meaning": src["meaning"],
        "partOfSpeech": enr["partOfSpeech"],
        "jlptLevel": level,
        "scenarioTags": enr["scenarioTags"],
        "exampleSentences": [clean_ja(s) for s in enr["exampleSentences"]],
    }

def assemble_grammar(level: str, src: dict, enr: dict, idx: int) -> dict:
    out = {
        "id": f"grammar.{level.lower()}.{idx+1:03d}",
        "pattern": clean_ja(src["grammar_point"]),
        "meaning": enr["meaning"],
        "jlptLevel": level,
        "formation": enr["formation"],
        "scenarioTags": enr["scenarioTags"],
        "exampleSentences": [clean_ja(s) for s in enr["exampleSentences"]],
    }
    if enr.get("commonMistakes"):
        out["commonMistakes"] = enr["commonMistakes"]
    return out

def merge_by_id(existing: list, incoming: list) -> list:
    seen = {x["id"] for x in existing}
    return existing + [x for x in incoming if x["id"] not in seen]

def main() -> int:
    new_vocab, new_grammar = [], []
    missing = []
    for level in LEVELS:
        v_path = Path(f"/tmp/enrich-{level}-vocab.json")
        g_path = Path(f"/tmp/enrich-{level}-grammar.json")
        if not v_path.exists():
            missing.append(str(v_path)); continue
        if not g_path.exists():
            missing.append(str(g_path)); continue
        v_enr = json.load(open(v_path))
        g_enr = json.load(open(g_path))
        v_src = SRC["vocab"][level]
        g_src = SRC["grammar"][level]
        if len(v_enr) != len(v_src):
            print(f"!! {level} vocab count mismatch: src={len(v_src)} enr={len(v_enr)}", file=sys.stderr)
        if len(g_enr) != len(g_src):
            print(f"!! {level} grammar count mismatch: src={len(g_src)} enr={len(g_enr)}", file=sys.stderr)
        for src, enr in zip(v_src, v_enr):
            new_vocab.append(assemble_vocab(level, src, enr))
        for i, (src, enr) in enumerate(zip(g_src, g_enr)):
            new_grammar.append(assemble_grammar(level, src, enr, i))

    if missing:
        print("Missing enrichment files:", file=sys.stderr)
        for m in missing: print(f"  {m}", file=sys.stderr)
        return 1

    vocab_path = OUT_DIR / "vocab.json"
    grammar_path = OUT_DIR / "grammar.json"
    existing_vocab = json.load(open(vocab_path)) if vocab_path.exists() else []
    existing_grammar = json.load(open(grammar_path)) if grammar_path.exists() else []
    merged_vocab = merge_by_id(existing_vocab, new_vocab)
    merged_grammar = merge_by_id(existing_grammar, new_grammar)
    json.dump(merged_vocab, open(vocab_path, "w"), ensure_ascii=False, indent=2)
    open(vocab_path, "a").write("\n")
    json.dump(merged_grammar, open(grammar_path, "w"), ensure_ascii=False, indent=2)
    open(grammar_path, "a").write("\n")
    print(f"vocab: {len(merged_vocab)} (+{len(new_vocab)})")
    print(f"grammar: {len(merged_grammar)} (+{len(new_grammar)})")
    return 0

if __name__ == "__main__":
    sys.exit(main())
