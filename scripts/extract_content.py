#!/usr/bin/env python3
"""Extract interview prep content from HTML sources into JSON data files."""
from __future__ import annotations

import json
import re
import html as html_lib
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parent.parent
ANSWERS = ROOT / "archive" / "with-answers.html"
PREP = ROOT / "archive" / "mmt-prep.html"
OUT = ROOT / "data" / "mmt"

# Fallback if still in project root
if not ANSWERS.exists():
    ANSWERS = ROOT / "with answers.html"
if not PREP.exists():
    PREP = ROOT / "mmt-prep.html"


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "• ", s, flags=re.I)
    s = re.sub(r"</li>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html_lib.unescape(s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def plain_code(pre_html: str) -> str:
    """Convert syntax-highlighted <pre> inner HTML to plain code."""
    # Replace span contents only — keep text
    text = re.sub(r"<br\s*/?>", "\n", pre_html, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_lib.unescape(text)
    # Normalize whitespace at line ends
    lines = [ln.rstrip() for ln in text.splitlines()]
    return "\n".join(lines).strip()


def freq_from_html(meta: str) -> str:
    if "freq-high" in meta:
        return "high"
    if "freq-med" in meta:
        return "med"
    return "low"


def tags_from_meta(meta: str) -> list[str]:
    return re.findall(r'class="pill[^"]*"[^>]*>([^<]+)', meta)


def extract_links(body: str) -> list[dict]:
    links = []
    for m in re.finditer(r'<a class="lc-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, re.S):
        label = strip_tags(m.group(2)).replace("🔗 ", "").strip()
        links.append({"label": label, "url": m.group(1)})
    return links


def extract_source(body: str) -> str | None:
    m = re.search(r'<span class="source-tag"[^>]*>(.*?)</span>', body, re.S)
    return strip_tags(m.group(1)) if m else None


def extract_solutions(body: str) -> list[dict]:
    sols = []
    for panel in re.finditer(
        r'<div class="code-panel[^"]*"[^>]*data-lang="([^"]+)"[^>]*>\s*<pre>(.*?)</pre>',
        body,
        re.S,
    ):
        lang = panel.group(1)
        code = plain_code(panel.group(2))
        label = {"cpp": "C++", "java": "Java", "python": "Python"}.get(lang, lang.upper())
        sols.append({"lang": lang, "label": label, "code": code})
    return sols


def extract_answer_html(body: str) -> str | None:
    """Prefer ans-text; else hint; keep simple HTML for lists/code."""
    m = re.search(r'<div class="ans-text"[^>]*>(.*?)</div>\s*(?=<span class="source-tag"|</div>\s*</div>\s*$|<a class="lc-link")', body, re.S)
    if not m:
        m = re.search(r'<div class="ans-text"[^>]*>(.*?)</div>', body, re.S)
    if m:
        return clean_answer_html(m.group(1))
    m = re.search(r'<div class="hint"[^>]*>(.*?)</div>', body, re.S)
    if m:
        return f"<p>{strip_tags(m.group(1))}</p>"
    return None


def clean_answer_html(inner: str) -> str:
    # Remove nested code-tabs from answer (those go to solutions)
    inner = re.sub(r'<div class="code-tabs">.*?</div>\s*(?=<|$)', "", inner, flags=re.S)
    # Keep strong, code, ul, li, br, p
    # Convert leftover to safe HTML
    # Strip class attributes on remaining tags we keep
    text = inner.strip()
    # If it still has code-tabs remnants cleaned, normalize
    return text


def extract_body_para(body: str) -> str:
    # First <p> that's not inside ans-text
    for m in re.finditer(r"<p>(.*?)</p>", body, re.S):
        start = m.start()
        before = body[:start]
        if before.rfind("ans-text") > before.rfind("</div>") or "ans-text" in before[-80:]:
            # rough check — skip if inside ans
            pass
        content = strip_tags(m.group(1))
        if content:
            return content
    return ""


def split_section(html: str, section_id: str) -> str:
    m = re.search(
        rf'<section id="{section_id}"[^>]*>(.*?)</section>',
        html,
        re.S,
    )
    return m.group(1) if m else ""


def parse_q_cards(section_html: str, id_prefix: str) -> tuple[list[dict], list[dict]]:
    """Return (categories with questions, flat list). Categories from cat-headers."""
    # Split by cat-header OR just collect cards
    parts = re.split(r'(<div class="cat-header">.*?</div>)', section_html, flags=re.S)
    categories: list[dict] = []
    current_cat = "General"
    current_icon = ""
    flat: list[dict] = []
    counter = 0

    def add_cards(chunk: str, category: str):
        nonlocal counter
        for card in re.finditer(r'<div class="q-card"[^>]*>(.*?)</div>\s*(?=<div class="q-card"|<div class="cat-header"|$)', chunk, re.S):
            # Better: find each q-card with nested structure
            pass

    # Simpler: find all q-cards with their preceding cat
    # Rebuild by scanning
    tokens = list(re.finditer(
        r'<div class="cat-header">(.*?)</div>|<div class="q-card"[^>]*onclick="toggle\(this\)">(.*?)</div>\s*(?=<div class="q-card"|<div class="cat-header"|</div>\s*</section>|$)',
        section_html,
        re.S,
    ))
    # The nested </div> matching is hard. Use a different approach: find all q-card starts and extract until matching depth.

    cards_raw = extract_divs_by_class(section_html, "q-card")
    cat_positions = [(m.start(), strip_tags(re.search(r'class="cat-title"[^>]*>([^<]+)', m.group(0)).group(1)) if re.search(r'class="cat-title"', m.group(0)) else "General")
                     for m in re.finditer(r'<div class="cat-header">.*?</div>', section_html, re.S)]

    for card_html, start in cards_raw:
        category = "General"
        for pos, title in cat_positions:
            if pos < start:
                category = title
            else:
                break
        counter += 1
        qid = f"{id_prefix}-{counter:03d}"
        title_m = re.search(r'<div class="q-title">(.*?)</div>', card_html, re.S)
        meta_m = re.search(r'<div class="q-meta">(.*?)</div>', card_html, re.S)
        body_m = re.search(r'<div class="q-body">(.*)</div>\s*$', card_html, re.S)
        if not title_m or not body_m:
            # try alternate body extract
            body_m = re.search(r'<div class="q-body">(.*?)</div>\s*</div>\s*$', card_html, re.S)
        title = strip_tags(title_m.group(1)) if title_m else f"Question {counter}"
        meta = meta_m.group(1) if meta_m else ""
        body = body_m.group(1) if body_m else ""
        # Remove nested q-body issues — get content between q-body open and last meaningful
        if not body:
            bm = re.search(r'<div class="q-body">(.*)', card_html, re.S)
            body = bm.group(1) if bm else ""

        item = {
            "id": qid,
            "title": title,
            "freq": freq_from_html(meta),
            "tags": tags_from_meta(meta),
            "category": category,
            "body": extract_body_para(body),
            "answer": extract_answer_html(body),
            "solutions": extract_solutions(body),
            "links": extract_links(body),
            "source": extract_source(body),
        }
        # Clean answer if it duplicated solutions only
        flat.append(item)

    # Group into categories
    by_cat: dict[str, list] = {}
    for item in flat:
        by_cat.setdefault(item["category"], []).append(item)
    categories = [{"title": k, "questions": v} for k, v in by_cat.items()]
    return categories, flat


def extract_divs_by_class(html: str, class_name: str) -> list[tuple[str, int]]:
    """Extract top-level divs with class containing class_name, return (inner+outer html, start)."""
    results = []
    pattern = re.compile(rf'<div class="[^"]*{re.escape(class_name)}[^"]*"[^>]*>')
    for m in pattern.finditer(html):
        start = m.start()
        i = m.end()
        depth = 1
        while i < len(html) and depth > 0:
            next_open = html.find("<div", i)
            next_close = html.find("</div>", i)
            if next_close == -1:
                break
            if next_open != -1 and next_open < next_close:
                # check it's a real div tag
                depth += 1
                i = next_open + 4
            else:
                depth -= 1
                i = next_close + 6
        results.append((html[start:i], start))
    return results


def parse_backend(section_html: str) -> list[dict]:
    topics = []
    topic_divs = extract_divs_by_class(section_html, "topic-card")
    t_idx = 0
    for topic_html, _ in topic_divs:
        t_idx += 1
        title_m = re.search(r'class="topic-title-text"[^>]*>(.*?)</span>', topic_html, re.S)
        if not title_m:
            title_m = re.search(r'class="topic-title"[^>]*>(.*?)</div>', topic_html, re.S)
        title = strip_tags(title_m.group(1)) if title_m else f"Topic {t_idx}"
        icon_m = re.search(r'class="cat-icon"[^>]*>([^<]+)', topic_html)
        icon = icon_m.group(1).strip() if icon_m else ""

        qa_items = []
        # qa-item divs
        items = extract_divs_by_class(topic_html, "qa-item")
        q_idx = 0
        if items:
            for item_html, _ in items:
                q_idx += 1
                q_m = re.search(r'<div class="qa-q">(.*?)</div>', item_html, re.S)
                a_m = re.search(r'<div class="ans-text"[^>]*>(.*?)</div>\s*(?:</div>\s*)?$', item_html, re.S)
                if not a_m:
                    a_m = re.search(r'<div class="ans-text"[^>]*>(.*)', item_html, re.S)
                question = strip_tags(q_m.group(1)) if q_m else f"Q{q_idx}"
                # Remove Q prefix artifact from ::before
                answer_html = ""
                if a_m:
                    ans_raw = a_m.group(1)
                    # If contains code-tabs, extract solutions separately
                    sols = extract_solutions(ans_raw)
                    ans_clean = re.sub(r'<div class="code-tabs">.*?</div>\s*', "", ans_raw, flags=re.S)
                    # Find closing - truncate at last meaningful
                    ans_clean = clean_answer_html(ans_clean)
                    answer_html = ans_clean
                    entry = {
                        "id": f"mmt-be-{t_idx:02d}-{q_idx:03d}",
                        "question": question,
                        "answer": answer_html,
                    }
                    if sols:
                        entry["solutions"] = sols
                    qa_items.append(entry)
        else:
            # prep-style: ul.topic-questions li
            for li in re.finditer(r"<li>(.*?)</li>", topic_html, re.S):
                q_idx += 1
                text = strip_tags(li.group(1))
                qa_items.append({
                    "id": f"mmt-be-{t_idx:02d}-{q_idx:03d}",
                    "question": text,
                    "answer": None,
                })

        topics.append({"id": f"mmt-be-topic-{t_idx:02d}", "title": title, "icon": icon, "items": qa_items})
    return topics


def parse_meta(overview: str, tips: str) -> dict:
    stats = []
    for m in re.finditer(
        r'<div class="stat-card"><div class="stat-num">([^<]+)</div><div class="stat-label">([^<]+)</div></div>',
        overview,
    ):
        stats.append({"num": m.group(1), "label": strip_tags(m.group(2))})

    process = []
    for m in re.finditer(
        r'<div class="process-step">.*?<div class="step-num">([^<]+)</div>.*?<div class="step-title">([^<]+)</div>.*?<div class="step-desc">(.*?)</div>',
        overview,
        re.S,
    ):
        process.append({
            "num": m.group(1).strip(),
            "title": strip_tags(m.group(2)),
            "desc": strip_tags(m.group(3)),
        })

    # Nested divs: capture from open tag through matching close (non-greedy to first
    # </div> would stop at tip-title). Match tip-title + following siblings until
    # the warn/tip box's own closing tag by requiring a tip-title then residual body.
    def parse_titled_box(html_fragment: str):
        tm = re.search(r'class="tip-title"[^>]*>(.*?)</div>', html_fragment, re.S)
        body = re.sub(r'<div class="tip-title"[^>]*>.*?</div>', "", html_fragment, count=1, flags=re.S)
        return (
            strip_tags(tm.group(1)) if tm else "",
            strip_tags(body).strip(),
            [strip_tags(li.group(1)) for li in re.finditer(r"<li[^>]*>(.*?)</li>", body, re.S)],
        )

    def extract_box(section_html: str, class_name: str):
        m = re.search(
            rf'<div class="{class_name}">\s*'
            r'(<div class="tip-title">.*?</div>)'
            r'(.*?)'
            r'</div>',
            section_html,
            re.S,
        )
        return m.group(0) if m else None

    warn = None
    warn_html = extract_box(overview, "warn-box")
    if warn_html:
        wtitle, wbody, _ = parse_titled_box(warn_html)
        warn = {"title": wtitle or "Note", "body": wbody}

    intro_m = re.search(r"<h1>(.*?)</h1>\s*<p[^>]*>(.*?)</p>", overview, re.S)
    title = strip_tags(intro_m.group(1)) if intro_m else "MakeMyTrip Interview Prep"
    intro = strip_tags(intro_m.group(2)) if intro_m else ""

    # Tips sections
    tip_boxes = []
    for m in re.finditer(
        r'<div class="tip-box">\s*'
        r'(<div class="tip-title">.*?</div>)'
        r'(.*?)'
        r'</div>',
        tips,
        re.S,
    ):
        ttitle, tbody, _ = parse_titled_box(m.group(0))
        tip_boxes.append({"title": ttitle, "body": tbody})

    tip_sections = []
    for m in re.finditer(r"<h2>(.*?)</h2>\s*<div class=\"topic-card\">(.*?)</div>", tips, re.S):
        items = [strip_tags(li.group(1)) for li in re.finditer(r"<li[^>]*>(.*?)</li>", m.group(2), re.S)]
        tip_sections.append({"title": strip_tags(m.group(1)), "items": items})

    warn_tips = None
    tips_warn_html = extract_box(tips, "warn-box")
    if tips_warn_html:
        wtitle, wbody, items = parse_titled_box(tips_warn_html)
        warn_tips = {"title": wtitle, "items": items or ([wbody] if wbody else [])}

    return {
        "title": title,
        "intro": intro,
        "stats": stats,
        "process": process,
        "overviewWarn": warn,
        "tipBoxes": tip_boxes,
        "tipSections": tip_sections,
        "tipWarn": warn_tips,
    }


STOP = {
    "a", "an", "the", "of", "in", "on", "to", "for", "and", "or", "with", "from",
    "using", "such", "that", "as", "by", "any", "all", "two", "find", "implement",
    "system", "problem", "check", "return", "get", "make", "end", "minimum",
}


def normalize_title(t: str) -> str:
    t = t.lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return t.strip()


def title_tokens(t: str) -> set[str]:
    return {w for w in normalize_title(t).split() if w and w not in STOP and len(w) > 1}


def is_dup_title(title: str, existing_titles: list[str]) -> bool:
    nt = normalize_title(title)
    tokens = title_tokens(title)
    for e in existing_titles:
        ne = normalize_title(e)
        if nt == ne:
            return True
        # one contains the other (after normalize)
        if nt in ne or ne in nt:
            return True
        a, b = tokens, title_tokens(e)
        if not a or not b:
            continue
        overlap = len(a & b) / min(len(a), len(b))
        # high overlap of distinctive words → duplicate
        if overlap >= 0.75 and len(a & b) >= 2:
            return True
        # shared rare multi-word cores
        cores = {"lru", "vending", "ratelimiter", "rate", "fizzbuzz", "josephus",
                 "hashmap", "freqstack", "dijkstra", "tarjan", "idempotent",
                 "irctc", "chatbot", "dream11", "messenger", "builder"}
        shared_core = (a & b) & cores
        if shared_core and len(a & b) >= 2:
            return True
        # special: jump game
        if {"jump", "game"} <= a and {"jump", "game"} <= b:
            return True
        if {"kth", "largest"} <= a and {"kth", "largest"} <= b:
            return True
        if {"unsorted", "subarray"} <= a and {"unsorted", "subarray"} <= b:
            return True
        # Valid BST variants
        if ("tree" in a and "tree" in b) and (
            ("bst" in a or "bst" in b or "search" in a or "search" in b)
            and (("valid" in a or "validate" in a) and ("valid" in b or "validate" in b or "check" in b or "check" in a))
        ):
            return True
        if "builder" in a and "thread" in "".join(a) and "builder" in b:
            return True
        if "cut" in a and "tree" in a and "cut" in b and "tree" in b:
            return True
        if "shortest" in a and "path" in a and "shortest" in b and "path" in b:
            return True
        if "dice" in a and "dice" in b:
            return True
        if "html" in a and "word" in a and "html" in b and "word" in b:
            return True
        if "builder" in a and "builder" in b:
            return True
        if "banking" in a and "banking" in b:
            return True
        if "url" in a and "shortener" in a and "url" in b and "shortener" in b:
            return True
        if "rate" in a and "limit" in "".join(a) and "rate" in b and "limit" in "".join(b):
            return True
        if "vending" in a and "vending" in b:
            return True
        if "fizzbuzz" in a and "fizzbuzz" in b:
            return True
        if "food" in a and "restaurant" in "".join(a) and "food" in b:
            return True
        if "idempotent" in a and "idempotent" in b:
            return True
    return False


def merge_gap_questions(primary: list[dict], prep_flat: list[dict], id_prefix: str) -> list[dict]:
    """Add prep questions not present in primary (strict fuzzy title match)."""
    existing_titles = [q["title"] for q in primary]
    next_id = max((int(q["id"].rsplit("-", 1)[-1]) for q in primary), default=0) + 1
    added = []
    for q in prep_flat:
        if is_dup_title(q["title"], existing_titles):
            continue
        q = dict(q)
        q["id"] = f"{id_prefix}-{next_id:03d}"
        next_id += 1
        existing_titles.append(q["title"])
        added.append(q)
        primary.append(q)
    return added


def regroup(flat: list[dict]) -> list[dict]:
    by_cat: dict[str, list] = {}
    order = []
    for item in flat:
        cat = item.get("category") or "General"
        if cat not in by_cat:
            by_cat[cat] = []
            order.append(cat)
        by_cat[cat].append(item)
    return [{"title": k, "questions": by_cat[k]} for k in order]


def main():
    answers_html = ANSWERS.read_text(encoding="utf-8")
    prep_html = PREP.read_text(encoding="utf-8")

    # --- Meta from answers ---
    meta = parse_meta(split_section(answers_html, "overview"), split_section(answers_html, "tips"))
    # Enrich tips from prep if thinner
    prep_meta = parse_meta(split_section(prep_html, "overview"), split_section(prep_html, "tips"))
    if len(prep_meta.get("tipSections") or []) > len(meta.get("tipSections") or []):
        # merge unique tip sections
        seen = {normalize_title(s["title"]) for s in meta["tipSections"]}
        for s in prep_meta["tipSections"]:
            if normalize_title(s["title"]) not in seen:
                meta["tipSections"].append(s)

    # --- DSA ---
    dsa_cats, dsa_flat = parse_q_cards(split_section(answers_html, "dsa"), "mmt-dsa")
    _, prep_dsa = parse_q_cards(split_section(prep_html, "dsa"), "mmt-dsa")
    added_dsa = merge_gap_questions(dsa_flat, prep_dsa, "mmt-dsa")
    print(f"DSA: {len(dsa_flat)} questions ({len(added_dsa)} gaps from prep)")

    # --- LLD ---
    lld_cats, lld_flat = parse_q_cards(split_section(answers_html, "lld"), "mmt-lld")
    _, prep_lld = parse_q_cards(split_section(prep_html, "lld"), "mmt-lld")
    added_lld = merge_gap_questions(lld_flat, prep_lld, "mmt-lld")
    print(f"LLD: {len(lld_flat)} questions ({len(added_lld)} gaps from prep)")

    # --- HLD ---
    hld_cats, hld_flat = parse_q_cards(split_section(answers_html, "hld"), "mmt-hld")
    _, prep_hld = parse_q_cards(split_section(prep_html, "hld"), "mmt-hld")
    added_hld = merge_gap_questions(hld_flat, prep_hld, "mmt-hld")
    print(f"HLD: {len(hld_flat)} questions ({len(added_hld)} gaps from prep)")

    # --- Backend ---
    backend = parse_backend(split_section(answers_html, "backend"))
    prep_backend = parse_backend(split_section(prep_html, "backend"))
    # Merge prep topics/questions not in answers
    existing_q = set()
    for t in backend:
        for it in t["items"]:
            existing_q.add(normalize_title(it["question"]))

    for pt in prep_backend:
        # find matching topic or add
        match = None
        for t in backend:
            if normalize_title(t["title"]) == normalize_title(pt["title"]) or (
                set(normalize_title(t["title"]).split()) & set(normalize_title(pt["title"]).split())
            ):
                # loose: if significant word overlap
                a = set(normalize_title(t["title"]).split())
                b = set(normalize_title(pt["title"]).split())
                if len(a & b) >= min(2, len(b)):
                    match = t
                    break
        if match:
            for it in pt["items"]:
                if normalize_title(it["question"]) not in existing_q:
                    # re-id
                    n = len(match["items"]) + 1
                    tid = match["id"].replace("mmt-be-topic-", "")
                    it = dict(it)
                    it["id"] = f"mmt-be-{tid}-{n:03d}"
                    match["items"].append(it)
                    existing_q.add(normalize_title(it["question"]))
        else:
            backend.append(pt)

    be_count = sum(len(t["items"]) for t in backend)
    print(f"Backend: {len(backend)} topics, {be_count} Qs")

    OUT.mkdir(parents=True, exist_ok=True)

    def dump(name, obj):
        path = OUT / name
        path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {path}")

    dump("meta.json", meta)
    dump("dsa.json", {"categories": regroup(dsa_flat)})
    dump("lld.json", {"categories": regroup(lld_flat)})
    dump("hld.json", {"categories": regroup(hld_flat)})
    dump("backend.json", {"topics": backend})

    # companies registry
    companies = {
        "companies": [
            {
                "id": "mmt",
                "slug": "mmt",
                "name": "MakeMyTrip",
                "shortName": "MMT",
                "role": "Backend / SDE",
                "accent": "#f78166",
                "description": "DSA (C++), Backend Java Q&A, LLD & HLD for SDE-1 to SSE.",
                "tabs": ["overview", "dsa", "backend", "lld", "hld", "tips"],
            }
        ]
    }
    (ROOT / "data" / "companies.json").write_text(
        json.dumps(companies, indent=2) + "\n", encoding="utf-8"
    )
    print("Wrote data/companies.json")


if __name__ == "__main__":
    main()
