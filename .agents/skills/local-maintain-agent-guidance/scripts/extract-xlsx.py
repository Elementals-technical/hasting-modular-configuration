#!/usr/bin/env python3
"""Normalize an XLSX source (RAW -> NORMALIZED) without third-party packages.

Usage: python3 -I extract-xlsx.py <source_id> <file.xlsx> <out_dir>

Writes to <out_dir>:
  <NN>-<sheet>.csv   every non-empty row: row number + cell values by column letter (formulas keep the cached value)
  formulas.csv       sheet, cell, formula
  links.csv          sheet, cell, url
  notes.csv          sheet, cell, author, text (legacy notes and threaded comments)
  summary.json       per-sheet used range, non-empty rows, formulas, links, notes + sha256
On macOS use /usr/bin/python3 (Homebrew python here lacks expat).
"""
import csv
import hashlib
import json
import os
import re
import sys
import zipfile
import posixpath
import xml.etree.ElementTree as ET

S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PR = "http://schemas.openxmlformats.org/package/2006/relationships"
TC = "http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"
q = lambda ns, t: f"{{{ns}}}{t}"


def col_of(ref):
    return re.match(r"[A-Z]+", ref).group(0)


def col_index(col):
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def rels_for(z, part):
    d, f = posixpath.split(part)
    name = posixpath.join(d, "_rels", f + ".rels")
    if name not in z.namelist():
        return {}
    out = {}
    for r in ET.fromstring(z.read(name)).iter(q(PR, "Relationship")):
        tgt = r.get("Target")
        if r.get("TargetMode") != "External":
            tgt = posixpath.normpath(posixpath.join(d, tgt)) if not tgt.startswith("/") else tgt.lstrip("/")
        out[r.get("Id")] = (r.get("Type").rsplit("/", 1)[-1], tgt)
    return out


def rich_text(el):
    return "".join(t.text or "" for t in el.iter(q(S, "t")))


def main():
    source_id, path, out_dir = sys.argv[1:4]
    os.makedirs(out_dir, exist_ok=True)
    data = open(path, "rb").read()
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        shared = [rich_text(si) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(q(S, "si"))]
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    wb_rels = rels_for(z, "xl/workbook.xml")
    formulas, links, notes, sheets = [], [], [], []
    for n, sh in enumerate(wb.iter(q(S, "sheet")), start=1):
        name = sh.get("name")
        part = wb_rels[sh.get(q(RNS, "id"))][1]
        root = ET.fromstring(z.read(part))
        srels = rels_for(z, part)
        dim = root.find(q(S, "dimension"))
        rows_out, max_col = [], 0
        f_count = 0
        for row in root.iter(q(S, "row")):
            values = {}
            for c in row.findall(q(S, "c")):
                ref = c.get("r")
                t = c.get("t")
                v = c.find(q(S, "v"))
                f = c.find(q(S, "f"))
                if f is not None and (f.text or f.get("t") == "shared"):
                    f_count += 1
                    formulas.append({"sheet": name, "cell": ref, "formula": f.text or f"(shared {f.get('si')})"})
                if t == "s" and v is not None:
                    val = shared[int(v.text)]
                elif t == "inlineStr":
                    val = rich_text(c)
                elif v is not None:
                    val = v.text or ""
                else:
                    val = ""
                if val.strip():
                    values[col_of(ref)] = val.strip()
            if values:
                max_col = max(max_col, max(col_index(k) for k in values))
                rows_out.append((int(row.get("r")), values))
        for hl in root.iter(q(S, "hyperlink")):
            rid = hl.get(q(RNS, "id"))
            url = srels.get(rid, ("", ""))[1] if rid else hl.get("location", "")
            links.append({"sheet": name, "cell": hl.get("ref"), "url": url})
        n_notes = 0
        for kind, target in srels.values():
            if kind == "comments" and target in z.namelist():
                croot = ET.fromstring(z.read(target))
                authors = [a.text for a in croot.iter(q(S, "author"))]
                for cm in croot.iter(q(S, "comment")):
                    a = cm.get("authorId")
                    notes.append({"sheet": name, "cell": cm.get("ref"), "author": authors[int(a)] if a and a.isdigit() and int(a) < len(authors) else "", "text": rich_text(cm)})
                    n_notes += 1
            elif kind == "threadedComment" and target in z.namelist():
                for tcm in ET.fromstring(z.read(target)).iter(q(TC, "threadedComment")):
                    txt = tcm.find(q(TC, "text"))
                    notes.append({"sheet": name, "cell": tcm.get("ref"), "author": tcm.get("personId", ""), "text": (txt.text if txt is not None else "")})
                    n_notes += 1
        cols = [chr(64 + i) if i <= 26 else chr(64 + (i - 1) // 26) + chr(65 + (i - 1) % 26) for i in range(1, max_col + 1)]
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name.strip())[:40]
        with open(os.path.join(out_dir, f"{n:02d}-{safe}.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["row"] + cols)
            for r, values in rows_out:
                w.writerow([r] + [values.get(c, "") for c in cols])
        sheets.append({
            "index": n,
            "name": name,
            "dimension": dim.get("ref") if dim is not None else "",
            "non_empty_rows": len(rows_out),
            "max_row_with_value": rows_out[-1][0] if rows_out else 0,
            "formulas": f_count,
            "links": sum(1 for l in links if l["sheet"] == name),
            "notes": n_notes,
        })
    for fname, rows, fields in (("formulas.csv", formulas, ["sheet", "cell", "formula"]), ("links.csv", links, ["sheet", "cell", "url"]), ("notes.csv", notes, ["sheet", "cell", "author", "text"])):
        with open(os.path.join(out_dir, fname), "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
    summary = {"source_id": source_id, "file": os.path.basename(path), "sha256": hashlib.sha256(data).hexdigest(), "size_bytes": len(data), "sheets": sheets}
    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)
    print(json.dumps({"source_id": source_id, "sheets": [(s["name"], s["non_empty_rows"], s["formulas"], s["links"], s["notes"]) for s in sheets]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
