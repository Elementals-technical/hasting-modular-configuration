#!/usr/bin/env python3
"""Normalize a DOCX source (RAW -> NORMALIZED) without third-party packages.

Usage: python3 -I extract-docx.py <source_id> <file.docx> <out_dir> [<media_dir>]

Writes to <out_dir>:
  paragraphs.jsonl  top-level body paragraphs; id P0000 = python-docx paragraph index
                    (same scheme as HASTINGS_AGENT_HANDOFF/SOURCE_EXTRACTS), with links, images, comment ids
  tables.jsonl      table cells as T<t>R<r>C<c> with text
  comments.jsonl    comment threads: id, author, date, text, resolved (w15:done), parent, anchor id and text
  media.csv         embedded images with the anchoring paragraph/table id and nearest heading
  links.csv         every external hyperlink with its anchor id
  summary.json      counts + sha256
<media_dir> (optional) receives the extracted image files for visual review.
On macOS use /usr/bin/python3 (Homebrew python here lacks expat).
"""
import csv
import hashlib
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
W14 = "http://schemas.microsoft.com/office/word/2010/wordml"
W15 = "http://schemas.microsoft.com/office/word/2012/wordml"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
q = lambda ns, tag: f"{{{ns}}}{tag}"


def text_of(el):
    parts = []
    for node in el.iter():
        if node.tag == q(W, "t") and node.text:
            parts.append(node.text)
        elif node.tag == q(W, "tab"):
            parts.append("\t")
        elif node.tag in (q(W, "br"), q(W, "cr")):
            parts.append("\n")
    return "".join(parts).strip()


def load_rels(z, part):
    name = f"word/_rels/{part}.rels"
    if name not in z.namelist():
        return {}
    root = ET.fromstring(z.read(name))
    return {r.get("Id"): (r.get("Target"), r.get("TargetMode")) for r in root.iter(q(REL, "Relationship"))}


def main():
    source_id, path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    media_dir = sys.argv[4] if len(sys.argv) > 4 else None
    os.makedirs(out_dir, exist_ok=True)
    data = open(path, "rb").read()
    z = zipfile.ZipFile(path)
    doc = ET.fromstring(z.read("word/document.xml"))
    rels = load_rels(z, "document.xml")
    body = doc.find(q(W, "body"))

    paragraphs, tables, media_rows, link_rows = [], [], [], []
    comment_anchor = {}  # comment id -> (anchor id, text)
    open_ranges = {}
    heading = ""
    t_index = -1

    def scan_block(block, anchor_id):
        """Collect links, images, comment ranges inside one paragraph or cell."""
        links, images, cids = [], [], []
        for node in block.iter():
            if node.tag == q(W, "hyperlink") and node.get(q(R, "id")) in rels:
                target, mode = rels[node.get(q(R, "id"))]
                if mode == "External":
                    links.append(target)
            elif node.tag == q(W, "instrText") and node.text and "HYPERLINK" in node.text:
                m = re.search(r'HYPERLINK\s+"([^"]+)"', node.text)
                if m:
                    links.append(m.group(1))
            elif node.tag == q(A, "blip"):
                rid = node.get(q(R, "embed")) or node.get(q(R, "link"))
                if rid in rels:
                    images.append(rels[rid][0])
            elif node.tag == q(W, "commentRangeStart"):
                cid = node.get(q(W, "id"))
                open_ranges[cid] = [anchor_id, []]
                cids.append(cid)
            elif node.tag == q(W, "commentReference"):
                cid = node.get(q(W, "id"))
                if cid not in cids:
                    cids.append(cid)
                comment_anchor.setdefault(cid, (anchor_id, text_of(block)[:300]))
            elif node.tag == q(W, "commentRangeEnd"):
                cid = node.get(q(W, "id"))
                if cid in open_ranges:
                    start, buf = open_ranges.pop(cid)
                    buf.append(text_of(block))
                    comment_anchor[cid] = (start, " ".join(t for t in buf if t)[:300])
        for cid, entry in open_ranges.items():
            if entry[0] != anchor_id or not entry[1]:
                entry[1].append(text_of(block))
        return links, images, cids

    # P-ids: 1-based over every w:p in document order, table cells included
    # (matches HASTINGS_AGENT_HANDOFF/SOURCE_EXTRACTS and LOCAL_COMMENT_THREADS anchors).
    pid_of = {}
    for p_index, para in enumerate(body.iter(q(W, "p")), start=1):
        pid = f"P{p_index:04d}"
        pid_of[para] = pid
        style_el = para.find(f"{q(W, 'pPr')}/{q(W, 'pStyle')}")
        style = style_el.get(q(W, "val")) if style_el is not None else ""
        text = text_of(para)
        if style.lower().startswith(("heading", "title")) and text:
            heading = text[:120]
        links, images, cids = scan_block(para, pid)
        paragraphs.append({"id": pid, "style": style, "text": text, "links": links, "images": images, "comments": cids, "heading": heading})
        for img in images:
            media_rows.append({"anchor": pid, "media": img, "heading": heading, "context": text[:160]})
        for link in links:
            link_rows.append({"anchor": pid, "url": link, "context": text[:160]})
    for tbl in body.iter(q(W, "tbl")):
        t_index += 1
        for r_i, row in enumerate(tbl.findall(q(W, "tr"))):
            for c_i, cell in enumerate(row.findall(q(W, "tc"))):
                first = next(iter(cell.iter(q(W, "p"))), None)
                tables.append({"id": f"T{t_index:02d}R{r_i:03d}C{c_i:02d}", "first_paragraph": pid_of.get(first, ""), "text": text_of(cell)})

    # comments + resolved/reply state
    comments = []
    names = z.namelist()
    if "word/comments.xml" in names:
        extended = {}
        if "word/commentsExtended.xml" in names:
            for ex in ET.fromstring(z.read("word/commentsExtended.xml")).iter(q(W15, "commentEx")):
                extended[ex.get(q(W15, "paraId"))] = (ex.get(q(W15, "done")) == "1", ex.get(q(W15, "paraIdParent")))
        para_to_cid = {}
        raw = []
        for c in ET.fromstring(z.read("word/comments.xml")).iter(q(W, "comment")):
            cid = c.get(q(W, "id"))
            paras = c.findall(q(W, "p"))
            last_para = paras[-1].get(q(W14, "paraId")) if paras else None
            for p in paras:
                para_to_cid[p.get(q(W14, "paraId"))] = cid
            raw.append((cid, c, last_para))
        for cid, c, last_para in raw:
            done, parent_para = extended.get(last_para, (None, None))
            anchor = comment_anchor.get(cid, ("", ""))
            comments.append({
                "id": f"{source_id}#C{cid}",
                "comment_id": cid,
                "author": c.get(q(W, "author")),
                "date": c.get(q(W, "date")),
                "text": text_of(c),
                "resolved": done,
                "parent": f"{source_id}#C{para_to_cid[parent_para]}" if parent_para in para_to_cid else None,
                "anchor": anchor[0],
                "anchor_text": anchor[1],
            })

    if media_dir:
        os.makedirs(media_dir, exist_ok=True)
        for name in names:
            if name.startswith("word/media/"):
                with open(os.path.join(media_dir, os.path.basename(name)), "wb") as fh:
                    fh.write(z.read(name))

    def write_jsonl(name, rows):
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    def write_csv(name, rows, fields):
        with open(os.path.join(out_dir, name), "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)

    write_jsonl("paragraphs.jsonl", paragraphs)
    write_jsonl("tables.jsonl", tables)
    write_jsonl("comments.jsonl", comments)
    write_csv("media.csv", media_rows, ["anchor", "media", "heading", "context"])
    write_csv("links.csv", link_rows, ["anchor", "url", "context"])
    summary = {
        "source_id": source_id,
        "file": os.path.basename(path),
        "sha256": hashlib.sha256(data).hexdigest(),
        "size_bytes": len(data),
        "paragraphs": len(paragraphs),
        "text_paragraphs": sum(1 for p in paragraphs if p["text"]),
        "table_cells": len(tables),
        "comments": len(comments),
        "comment_threads": sum(1 for c in comments if not c["parent"]),
        "comments_resolved": sum(1 for c in comments if c["resolved"] is True),
        "comments_resolution_unknown": sum(1 for c in comments if c["resolved"] is None),
        "media_files": sum(1 for n in names if n.startswith("word/media/")),
        "media_anchored": len(media_rows),
        "links": len(link_rows),
    }
    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
