# -*- coding: utf-8 -*-
"""从 docx 中提取一级目录（仅一级标题），输出到 txt。"""
import zipfile
import xml.etree.ElementTree as ET
import os
import sys

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}


def get_paragraph_text(p):
    texts = []
    for t in p.iter("{%s}t" % W_NS):
        if t.text:
            texts.append(t.text)
        if t.tail:
            texts.append(t.tail)
    return "".join(texts).strip()


def extract_heading1_items(root):
    items = []
    for p in root.iter("{%s}p" % W_NS):
        p_pr = p.find("w:pPr", NS)
        if p_pr is None:
            continue
        is_heading1 = False
        p_style = p_pr.find("w:pStyle", NS)
        if p_style is not None:
            val = p_style.get("{%s}val" % W_NS)
            if val and (
                "Heading1" in (val or "").lower()
                or val in ("1", "一级标题", "标题 1")
            ):
                is_heading1 = True
        outline = p_pr.find("w:outlineLvl", NS)
        if outline is not None:
            lvl = outline.get("{%s}val" % W_NS)
            if lvl == "0":
                is_heading1 = True
        if is_heading1:
            text = get_paragraph_text(p)
            if text:
                items.append(text)
    return items


def main():
    docx_path = sys.argv[1] if len(sys.argv) > 1 else (
        r"E:\zhangying\招投标文件\曹可心-中信信托大集中报表系统升级改造项目投标文件\中信信托大集中报表系统升级改造项目投标文件-正本-1205.docx"
    )
    out_path = sys.argv[2] if len(sys.argv) > 2 else "toc_level1.txt"

    if not os.path.exists(docx_path):
        print("文件不存在:", docx_path, file=sys.stderr)
        sys.exit(1)

    with zipfile.ZipFile(docx_path, "r") as z:
        with z.open("word/document.xml") as f:
            tree = ET.parse(f)
    root = tree.getroot()

    items = extract_heading1_items(root)

    if not items:
        for p in root.iter("{%s}p" % W_NS):
            text = get_paragraph_text(p)
            if not text or len(text) > 200:
                continue
            if (
                text.startswith("第") and "章" in text[:10]
            ) or (
                len(text) >= 2 and text[0] in "一二三四五六七八九十" and text[1] in "、."
            ) or (
                text.startswith("一、") or text.startswith("二、") or text.startswith("三、")
            ):
                items.append(text)

    out_dir = os.path.dirname(out_path)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(items))

    print("提取到 %d 个一级标题，已写入: %s" % (len(items), out_path))


if __name__ == "__main__":
    main()
