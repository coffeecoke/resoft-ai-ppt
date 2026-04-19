# -*- coding: utf-8 -*-
"""
批量提取目录下所有 docx 的目录结构（多级标题）并输出到 txt。

用法:
  python batch_extract_docx_toc_to_txt.py [输入目录] [输出目录]

  不传参时:
    输入目录: E:\\pre-sales-file-data\\upload\\docx-outputs
    输出目录: 与输入目录相同，每个 docx 生成同名的 .txt
"""
import zipfile
import xml.etree.ElementTree as ET
import os
import sys

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}

# 默认输入目录
DEFAULT_INPUT_DIR = r"E:\pre-sales-file-data\upload\docx-outputs"


def get_paragraph_text(p):
    texts = []
    for t in p.iter("{%s}t" % W_NS):
        if t.text:
            texts.append(t.text)
        if t.tail:
            texts.append(t.tail)
    return "".join(texts).strip()


def get_heading_level(p):
    """返回段落的大纲级别：1=一级标题，2=二级，0=非标题。"""
    p_pr = p.find("w:pPr", NS)
    if p_pr is None:
        return 0
    # 先看 outlineLvl
    outline = p_pr.find("w:outlineLvl", NS)
    if outline is not None:
        val = outline.get("{%s}val" % W_NS)
        if val is not None:
            try:
                return int(val) + 1  # 0->1, 1->2, ...
            except ValueError:
                pass
    # 再看样式名
    p_style = p_pr.find("w:pStyle", NS)
    if p_style is not None:
        val = (p_style.get("{%s}val" % W_NS) or "").strip()
        if not val:
            return 0
        val_lower = val.lower()
        if "heading1" in val_lower or val in ("1", "一级标题", "标题 1"):
            return 1
        if "heading2" in val_lower or val in ("2", "二级标题", "标题 2"):
            return 2
        if "heading3" in val_lower or val in ("3", "三级标题", "标题 3"):
            return 3
        if "heading4" in val_lower or val in ("4", "四级标题", "标题 4"):
            return 4
        if "heading5" in val_lower or val in ("5", "五级标题", "标题 5"):
            return 5
        if "heading" in val_lower:
            try:
                return int(val.replace("heading", "").strip()) or 1
            except ValueError:
                return 1
    return 0


def extract_toc_structure(root):
    """
    提取文档中所有带大纲级别的段落，返回 [(level, text), ...]。
    """
    items = []
    for p in root.iter("{%s}p" % W_NS):
        level = get_heading_level(p)
        if level == 0:
            continue
        text = get_paragraph_text(p)
        if not text:
            continue
        items.append((level, text))
    return items


def fallback_toc_by_pattern(root):
    """
    若没有样式/大纲级别，则用常见中文标题模式兜底（一级）。
    """
    items = []
    for p in root.iter("{%s}p" % W_NS):
        text = get_paragraph_text(p)
        if not text or len(text) > 200:
            continue
        if (
            (text.startswith("第") and "章" in text[:10])
            or (len(text) >= 2 and text[0] in "一二三四五六七八九十" and text[1] in "、.")
            or text.startswith("一、")
            or text.startswith("二、")
            or text.startswith("三、")
            or text.startswith("四、")
            or text.startswith("五、")
            or text.startswith("六、")
            or text.startswith("七、")
            or text.startswith("八、")
            or text.startswith("九、")
            or text.startswith("十、")
        ):
            items.append((1, text))
    return items


def format_toc_to_lines(items):
    """将 [(level, text), ...] 格式化为带缩进的文本行。"""
    lines = []
    for level, text in items:
        indent = "  " * (level - 1)  # 一级不缩进，二级2空格，三级4空格…
        lines.append(indent + text)
    return lines


def process_one_docx(docx_path, out_path):
    """
    处理单个 docx，把目录结构写入 out_path。
    返回 (成功与否, 条目数)。
    """
    try:
        with zipfile.ZipFile(docx_path, "r") as z:
            with z.open("word/document.xml") as f:
                tree = ET.parse(f)
        root = tree.getroot()
    except Exception as e:
        print("  读取失败: %s" % e, file=sys.stderr)
        return False, 0

    items = extract_toc_structure(root)
    if not items:
        items = fallback_toc_by_pattern(root)

    lines = format_toc_to_lines(items)
    out_dir = os.path.dirname(out_path)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return True, len(items)


def main():
    input_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT_DIR
    output_dir = sys.argv[2] if len(sys.argv) > 2 else input_dir

    if not os.path.isdir(input_dir):
        print("目录不存在: %s" % input_dir, file=sys.stderr)
        sys.exit(1)

    docx_files = [
        f
        for f in os.listdir(input_dir)
        if f.lower().endswith(".docx") and os.path.isfile(os.path.join(input_dir, f))
    ]
    if not docx_files:
        print("该目录下没有 .docx 文件: %s" % input_dir)
        return

    print("输入目录: %s" % input_dir)
    print("输出目录: %s" % output_dir)
    print("找到 %d 个 docx 文件\n" % len(docx_files))

    ok_count = 0
    for name in sorted(docx_files):
        base = os.path.splitext(name)[0]
        docx_path = os.path.join(input_dir, name)
        txt_name = base + ".txt"
        out_path = os.path.join(output_dir, txt_name)
        success, n = process_one_docx(docx_path, out_path)
        if success:
            ok_count += 1
            print("  [OK] %s -> %s (%d 条)" % (name, txt_name, n))
        else:
            print("  [FAIL] %s" % name)

    print("\n完成: %d/%d 个文件已输出到 txt" % (ok_count, len(docx_files)))


if __name__ == "__main__":
    main()
