"""
投标文件 DOCX 章节拆分服务 v3

核心改进：
  1. outlineLevel=0 识别一级标题，兼容所有自定义样式
  2. 自动跳过目录区域，避免 TOC 行干扰定位
  3. zip 后处理注入 media + fontTable，彻底修复图片缺失和字体乱码

调用方式（Node.js subprocess）：
  python splitter.py <input.docx> <output_dir> <sections_json>

  sections_json 格式：
  [{"title": "投标函", "start_keyword": "投标函"}]

输出：stdout 打印 JSON
  {"success": true, "sections": [{"title": "...", "docx_path": "...", "text": "...", "error": null}]}
"""

import sys
import os
import io
import json
import copy
import zipfile
import re
import shutil

# Windows 控制台默认 GBK 编码，遇到特殊 Unicode 字符会崩溃，强制 stdout 使用 UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import tempfile
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from lxml import etree


# ─────────────────────────────────────────────
# 工具：文本提取
# ─────────────────────────────────────────────

def get_elem_text(elem) -> str:
    """从任意块元素提取纯文本（段落或表格）"""
    texts = []
    tag = etree.QName(elem.tag).localname
    if tag == 'tbl':
        for row in elem.iter(qn('w:tr')):
            row_texts = []
            for cell in row.iter(qn('w:tc')):
                cell_text = ''.join(t.text or '' for t in cell.iter(qn('w:t')))
                row_texts.append(cell_text)
            texts.append('\t'.join(row_texts))
        return '\n'.join(texts)
    else:
        return ''.join(t.text or '' for t in elem.iter(qn('w:t')))


def get_style_id(elem) -> str:
    """获取段落的 styleId"""
    pPr = elem.find(qn('w:pPr'))
    if pPr is None:
        return ''
    pStyle = pPr.find(qn('w:pStyle'))
    if pStyle is None:
        return ''
    return pStyle.get(qn('w:val'), '')


def get_outline_level(elem) -> int:
    """
    获取段落 outline level（0=一级标题，1=二级标题，None=正文）
    来源：w:pPr/w:outlineLvl 或 样式继承
    """
    pPr = elem.find(qn('w:pPr'))
    if pPr is not None:
        out = pPr.find(qn('w:outlineLvl'))
        if out is not None:
            try:
                return int(out.get(qn('w:val'), '9'))
            except ValueError:
                pass
    return None


def is_toc_style(style_id: str) -> bool:
    """判断是否是目录样式"""
    sid_upper = style_id.upper()
    return sid_upper.startswith('TOC') or sid_upper.startswith('TOCH')


# ─────────────────────────────────────────────
# 核心：识别文档中真正的一级章节
# 策略：优先用 outlineLevel=0 直接定位，
#       跳过目录区域（TOC样式段落），
#       再与 AI 给的 sections 做标题匹配
# ─────────────────────────────────────────────

def find_toc_range(body_elems: list) -> tuple:
    """
    找到目录区域的块索引范围 [toc_start, toc_end)
    目录特征：连续出现大量 TOC 样式段落（至少6个）

    注意：对于一级章节拆分出的子文档，总段落数可能本来就很少，
    不能把整个文档识别为 TOC，这里要求 TOC 区域占比不超过80%。
    """
    toc_start = -1
    toc_end = -1
    consecutive = 0
    MIN_TOC_CONSECUTIVE = 6  # 至少连续6个 TOC 样式段落才算目录区域

    for i, elem in enumerate(body_elems):
        tag = etree.QName(elem.tag).localname
        if tag != 'p':
            if consecutive > MIN_TOC_CONSECUTIVE:
                toc_end = i
                break
            consecutive = 0
            continue
        sid = get_style_id(elem)
        if is_toc_style(sid):
            if toc_start == -1:
                toc_start = i
            consecutive += 1
        else:
            if consecutive > MIN_TOC_CONSECUTIVE:
                toc_end = i
                break
            if consecutive <= MIN_TOC_CONSECUTIVE:
                toc_start = -1
            consecutive = 0

    if toc_start != -1 and toc_end == -1:
        toc_end = len(body_elems)

    # 安全检查：TOC 区域不能超过总段落数的80%（防止子文档被整体误判为目录）
    if toc_start != -1 and toc_end != -1:
        toc_ratio = (toc_end - toc_start) / max(len(body_elems), 1)
        if toc_ratio > 0.8:
            return (-1, -1)

    return (toc_start, toc_end) if toc_start != -1 else (-1, -1)


def find_heading_positions(body_elems: list, doc: Document, target_level: int = 0) -> list:
    """
    识别所有指定 outlineLevel 的标题在 body_elems 中的位置。

    target_level:
      0 = 一级标题（outlineLevel=0）
      1 = 二级标题（outlineLevel=1）
      依此类推

    策略（优先级递降）：
    1. 段落直接带 w:outlineLvl == target_level（最可靠）
    2. 样式表中 outlineLevel == target_level 的自定义样式（样式继承）
    3. 标准 Heading 样式名称匹配，如 "Heading1"/"1"/"2" 等（兜底）

    同时跳过目录区域。
    """
    # ── 建立 styleId → outlineLevel 的样式表映射 ──
    style_outline = {}
    # 同时记录 styleId → basedOn 关系，用于继承链追溯
    style_based_on = {}
    # Word 内置别名映射：数字 styleId → 标准 styleId（如 '1'→'Heading1'）
    # 通过扫描样式表的 w:styleId 和 w:aliases 字段建立
    style_alias_map = {}
    try:
        styles_elem = doc.part.styles._element
        for style in styles_elem.iter(qn('w:style')):
            sid = style.get(qn('w:styleId'), '')
            # w:aliases 存储别名（如 <w:aliases w:val="1"/>）
            aliases_elem = style.find(qn('w:aliases'))
            if aliases_elem is not None:
                aliases_val = aliases_elem.get(qn('w:val'), '')
                for alias in aliases_val.split(','):
                    alias = alias.strip()
                    if alias:
                        style_alias_map[alias] = sid

            # basedOn 继承链
            based = style.find(qn('w:basedOn'))
            if based is not None:
                style_based_on[sid] = based.get(qn('w:val'), '')
            pPr = style.find(qn('w:pPr'))
            if pPr is not None:
                out = pPr.find(qn('w:outlineLvl'))
                if out is not None:
                    try:
                        style_outline[sid] = int(out.get(qn('w:val'), '9'))
                    except ValueError:
                        pass
    except Exception:
        pass

    def _normalize_sid(sid: str) -> str:
        """
        将 styleId 规范化：
        1. 优先通过 w:aliases 别名映射找到真实 styleId
        2. 兜底处理 Word 内置数字 styleId（'1'=Heading1, '2'=Heading2 ...）
           这是 OOXML 规范中的隐式映射，不通过 w:aliases 声明
        """
        if sid in style_alias_map:
            return style_alias_map[sid]
        # 内置数字 ID：'1'→'Heading1', '2'→'Heading2', ..., '9'→'Heading9'
        if sid.isdigit() and 1 <= int(sid) <= 9:
            candidate = f'Heading{sid}'
            if candidate in style_outline:
                return candidate
        return sid

    def _resolve_outline_via_inheritance(sid: str, depth: int = 0) -> int | None:
        """沿 basedOn 继承链向上查 outlineLevel，最多追溯5层。先过别名规范化。"""
        if depth > 5 or not sid:
            return None
        normalized = _normalize_sid(sid)
        if normalized in style_outline:
            return style_outline[normalized]
        parent = style_based_on.get(normalized)
        if parent:
            return _resolve_outline_via_inheritance(parent, depth + 1)
        return None

    def _is_standard_heading_style(sid: str, level: int) -> bool:
        """
        判断 styleId 是否是标准 Heading N 样式（level 从0开始，Heading1=0）

        Word 有一套内置别名机制：styleId='1' 等价于 'Heading1'，
        '2' 等价于 'Heading2'，以此类推。
        常见写法：'Heading1', '1', 'heading1', '标题1', '2级标题' 等
        """
        sid_lower = sid.lower().replace(' ', '').replace('-', '').replace('_', '')
        level_num = level + 1  # outlineLevel 0 → Heading 1
        candidates = [
            f'heading{level_num}',
            str(level_num),            # Word 内置数字别名：'1'=Heading1, '2'=Heading2
            f'标题{level_num}',
            f'{level_num}级标题',
            f'heading{level_num}char',
        ]
        return sid_lower in candidates

    # 找目录区域，跳过
    toc_start, toc_end = find_toc_range(body_elems)

    h_positions = []
    for i, elem in enumerate(body_elems):
        # 跳过目录区域
        if toc_start != -1 and toc_start <= i < toc_end:
            continue

        tag = etree.QName(elem.tag).localname
        if tag != 'p':
            continue

        text = get_elem_text(elem).strip()
        if not text:
            continue

        # 策略1：直接检查 w:pPr/w:outlineLvl
        level = get_outline_level(elem)
        if level == target_level:
            h_positions.append((i, text))
            continue

        sid = get_style_id(elem)

        # 策略2：查样式表（含继承链追溯）
        resolved = _resolve_outline_via_inheritance(sid) if sid else None
        if resolved == target_level:
            h_positions.append((i, text))
            continue

        # 策略3：标准 Heading 样式名兜底
        if sid and _is_standard_heading_style(sid, target_level):
            h_positions.append((i, text))

    return h_positions


# 向后兼容别名（原来叫 find_heading1_positions，target_level 默认 0）
def find_heading1_positions(body_elems: list, doc: Document) -> list:
    return find_heading_positions(body_elems, doc, target_level=0)


def fuzzy_match(keyword: str, text: str) -> bool:
    """模糊匹配：去除空白后判断"""
    k = keyword.replace(' ', '').replace('\u3000', '').strip()
    t = text.replace(' ', '').replace('\u3000', '').strip()
    return k in t or t in k


def match_sections_to_positions(sections: list, h1_positions: list) -> list:
    """
    将 AI 给的 sections（title + start_keyword）与文档中真实的 H1 位置做匹配
    返回 [(section_dict, elem_idx, elem_text), ...]，按 elem_idx 排序
    """
    matched = []
    used_idx = set()

    for sec in sections:
        keyword = sec.get('start_keyword', '')
        title   = sec.get('title', '')
        best_idx = -1
        best_text = ''

        for idx, text in h1_positions:
            if idx in used_idx:
                continue
            # 匹配 start_keyword 或 title
            if fuzzy_match(keyword, text) or fuzzy_match(title, text):
                best_idx = idx
                best_text = text
                break

        if best_idx != -1:
            matched.append((sec, best_idx, best_text))
            used_idx.add(best_idx)
        else:
            # 没匹配到：记录下来但不加入 matched（后续报 error）
            matched.append((sec, -1, ''))

    # 按出现顺序排序
    matched.sort(key=lambda x: x[1] if x[1] != -1 else 999999)
    return matched


# ─────────────────────────────────────────────
# 核心：克隆块列表到新 Document（只处理 XML 内容）
# 图片/字体通过 zip 后处理注入，不走 python-docx API
# ─────────────────────────────────────────────

def clone_blocks_to_doc(source_doc: Document, block_elems: list) -> Document:
    """将块列表克隆到新 Document（样式+编号）。图片/字体后续 zip 注入。"""
    new_doc = Document()
    body = new_doc.element.body

    # 清空默认段落（保留 sectPr）
    sect_pr = body.find(qn('w:sectPr'))
    for child in list(body):
        if etree.QName(child.tag).localname != 'sectPr':
            body.remove(child)

    # 复制样式表
    _copy_styles(source_doc, new_doc)

    # 复制编号定义
    _copy_numbering(source_doc, new_doc)

    # 插入克隆的块
    for elem in block_elems:
        cloned = copy.deepcopy(elem)
        if sect_pr is not None:
            body.insert(list(body).index(sect_pr), cloned)
        else:
            body.append(cloned)

    return new_doc


def _copy_styles(src: Document, dst: Document):
    try:
        src_styles = src.element.find(qn('w:styles'))
        if src_styles is None:
            return
        dst_styles = dst.element.find(qn('w:styles'))
        if dst_styles is not None:
            dst.element.remove(dst_styles)
        dst.element.insert(
            list(dst.element).index(dst.element.body),
            copy.deepcopy(src_styles)
        )
    except Exception:
        pass


def _copy_numbering(src: Document, dst: Document):
    try:
        src_part = src.part
        if not hasattr(src_part, 'numbering_part') or src_part.numbering_part is None:
            return
        src_num_xml = src_part.numbering_part._element
        if src_num_xml is None:
            return
        dst_part = dst.part
        if hasattr(dst_part, 'numbering_part') and dst_part.numbering_part is not None:
            dst_part.numbering_part._element = copy.deepcopy(src_num_xml)
        else:
            from docx.opc.part import Part
            from docx.opc.constants import RELATIONSHIP_TYPE as RT
            num_blob = etree.tostring(src_num_xml, xml_declaration=True,
                                      encoding='UTF-8', standalone=True)
            numbering_part = Part(
                '/word/numbering.xml',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
                num_blob,
                dst_part.package
            )
            dst_part.relate_to(numbering_part, RT.NUMBERING)
    except Exception:
        pass


# ─────────────────────────────────────────────
# Zip 后处理：注入 media 文件 + fontTable + rels
# ─────────────────────────────────────────────

def _collect_all_rids(block_elems: list) -> set:
    """
    收集块中所有需要注入的 rId：
    - 图片（blip / imagedata）
    - OLE 嵌入对象（o:OLEObject r:id）
    - 超链接（w:hyperlink r:id）—— 外部链接不需要复制文件，但 rels 声明必须存在
    """
    rids = set()
    blip_ns   = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    rel_ns    = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    vml_ns    = 'urn:schemas-microsoft-com:vml'
    office_ns = 'urn:schemas-microsoft-com:office:office'
    word_ns   = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

    for elem in block_elems:
        # 1. DrawingML 内嵌图片
        for blip in elem.iter(f'{{{blip_ns}}}blip'):
            rid = blip.get(f'{{{rel_ns}}}embed')
            if rid:
                rids.add(rid)
        # 2. VML 图片（v:imagedata）
        for imagedata in elem.iter(f'{{{vml_ns}}}imagedata'):
            rid = imagedata.get(f'{{{rel_ns}}}id')
            if rid:
                rids.add(rid)
        # 3. OLE 嵌入对象（o:OLEObject）
        for ole in elem.iter(f'{{{office_ns}}}OLEObject'):
            rid = ole.get(f'{{{rel_ns}}}id')
            if rid:
                rids.add(rid)
        # 4. 超链接（w:hyperlink）
        for hyperlink in elem.iter(f'{{{word_ns}}}hyperlink'):
            rid = hyperlink.get(f'{{{rel_ns}}}id')
            if rid:
                rids.add(rid)
    return rids


# 向后兼容别名
_collect_image_rids = _collect_all_rids


def _parse_src_rels(src_zip: zipfile.ZipFile) -> dict:
    """
    解析源文件 word/_rels/document.xml.rels
    返回 {rId: {"type": ..., "target": ..., "target_mode": ...}}
    target_mode 为 "External" 表示外部链接，空字符串表示内部资源
    """
    rels = {}
    try:
        content = src_zip.read('word/_rels/document.xml.rels').decode('utf-8')
        # 逐条提取 Relationship 标签的各属性（属性顺序不定，用独立正则提取）
        for tag_m in re.finditer(r'<Relationship\b([^>]+?)/?>', content):
            attrs_str = tag_m.group(1)
            def get_attr(name, s=attrs_str):
                am = re.search(r'(?<!\w)' + name + r'="([^"]*)"', s)
                return am.group(1) if am else ''
            rid         = get_attr('Id')
            rtype       = get_attr('Type')
            target      = get_attr('Target')
            target_mode = get_attr('TargetMode')
            if rid:
                rels[rid] = {'type': rtype, 'target': target, 'target_mode': target_mode}
    except Exception:
        pass
    return rels


def inject_media_into_docx(out_path: str, src_path: str, block_elems: list):
    """
    在 python-docx save() 之后，重新打开输出 zip：
    1. 把源文件中被引用的 media / embeddings 文件直接复制进去
    2. 在 document.xml.rels 中追加对应的关系声明
       - 内部引用（media/embeddings）：复制文件 + 补 rels
       - 外部引用（超链接 TargetMode=External）：只补 rels，不复制文件
    3. 用源文件的 fontTable.xml 替换空白 fontTable
    """
    needed_rids = _collect_all_rids(block_elems)

    with zipfile.ZipFile(src_path, 'r') as src_zip:
        src_rels = _parse_src_rels(src_zip)

        # 分两类：需要复制文件的 / 只需要补 rels 声明的（外部链接）
        to_inject_files   = {}   # rid → {type, target, binary, zip_path}
        to_inject_extonly = {}   # rid → {type, target, target_mode}

        for rid in needed_rids:
            info = src_rels.get(rid)
            if not info:
                continue
            target      = info['target']
            target_mode = info.get('target_mode', '')

            if target_mode.lower() == 'external':
                # 外部链接：只补 rels 条目
                to_inject_extonly[rid] = {
                    'type':        info['type'],
                    'target':      target,
                    'target_mode': target_mode,
                }
                continue

            # 内部资源：需要复制文件（media / embeddings）
            src_zip_path = f'word/{target}'
            try:
                binary = src_zip.read(src_zip_path)
                to_inject_files[rid] = {
                    'type':     info['type'],
                    'target':   target,
                    'binary':   binary,
                    'zip_path': src_zip_path,
                }
            except KeyError:
                pass

        # 读取源 fontTable.xml 和 styles.xml
        src_font_table = None
        src_styles_xml = None
        try:
            src_font_table = src_zip.read('word/fontTable.xml')
        except KeyError:
            pass
        try:
            src_styles_xml = src_zip.read('word/styles.xml')
        except KeyError:
            pass

    if not to_inject_files and not to_inject_extonly and src_font_table is None and src_styles_xml is None:
        return

    # ── 重写目标 zip ──
    tmp_path = out_path + '.tmp'

    with zipfile.ZipFile(out_path, 'r') as zin:
        existing_names = set(zin.namelist())

        # 解析并更新 rels XML
        existing_rels_xml = zin.read('word/_rels/document.xml.rels').decode('utf-8')

        # 建立现有 rId → {'target', 'type', 'tag'} 映射
        existing_rid_map = {}
        for tag_m in re.finditer(r'<Relationship\b([^>]+?)/?>', existing_rels_xml):
            attrs = tag_m.group(1)
            rid_m  = re.search(r'(?<!\w)Id="([^"]*)"', attrs)
            tgt_m  = re.search(r'(?<!\w)Target="([^"]*)"', attrs)
            type_m = re.search(r'(?<!\w)Type="([^"]*)"', attrs)
            if rid_m:
                existing_rid_map[rid_m.group(1)] = {
                    'target': tgt_m.group(1) if tgt_m else '',
                    'type':   type_m.group(1) if type_m else '',
                    'tag':    tag_m.group(0),
                }

        new_rels_xml = existing_rels_xml

        # 所有已用 rId（包括待注入的），用于生成不冲突的新 rId
        all_used_rids = set(existing_rid_map.keys()) | set(to_inject_files) | set(to_inject_extonly)

        def _next_free_rid(used_set):
            """生成一个不冲突的新 rId"""
            i = 1
            while f'rId{i}' in used_set:
                i += 1
            new_rid = f'rId{i}'
            used_set.add(new_rid)
            return new_rid

        def _upsert_rel(rid, new_tag_str):
            """
            将 rid 对应的 rels 条目更新为 new_tag_str。
            - 若 rid 不存在：追加
            - 若 rid 已存在且 target 相同：跳过
            - 若 rid 已存在但 target 不同（被 python-docx 默认占用）：
                把被顶掉的条目换个新 rId 继续保留（fontTable/theme 等系统条目不能丢）
                然后再追加新 tag
            """
            nonlocal new_rels_xml
            if rid not in existing_rid_map:
                new_rels_xml = new_rels_xml.replace(
                    '</Relationships>', new_tag_str + '</Relationships>'
                )
                return

            displaced = existing_rid_map[rid]
            # 已有条目 target 就是我们想要的，不用动
            want_target = re.search(r'Target="([^"]*)"', new_tag_str)
            if want_target and displaced['target'] == want_target.group(1):
                return

            # rId 被占用：把原有条目换到新 rId 下继续保留
            new_displaced_rid = _next_free_rid(all_used_rids)
            displaced_new_tag = displaced['tag'].replace(
                f'Id="{rid}"', f'Id="{new_displaced_rid}"', 1
            )
            new_rels_xml = new_rels_xml.replace(displaced['tag'], displaced_new_tag, 1)
            # 再追加正确的图片/资源条目
            new_rels_xml = new_rels_xml.replace(
                '</Relationships>', new_tag_str + '</Relationships>'
            )

        # 处理内部资源
        for rid, info in to_inject_files.items():
            new_tag = (
                f'<Relationship Id="{rid}" Type="{info["type"]}" '
                f'Target="{info["target"]}"/>'
            )
            _upsert_rel(rid, new_tag)

        # 处理外部链接
        for rid, info in to_inject_extonly.items():
            new_tag = (
                f'<Relationship Id="{rid}" Type="{info["type"]}" '
                f'Target="{info["target"]}" TargetMode="External"/>'
            )
            _upsert_rel(rid, new_tag)

        # 解析并更新 Content_Types.xml（补充 media / embeddings 扩展名的 Default 条目）
        ct_xml = zin.read('[Content_Types].xml').decode('utf-8')
        ext_ct_map = {
            # 图片
            'png':  'image/png',
            'jpg':  'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif':  'image/gif',
            'bmp':  'image/bmp',
            'emf':  'image/x-emf',
            'wmf':  'image/x-wmf',
            'tiff': 'image/tiff',
            'svg':  'image/svg+xml',
            # OLE 通用
            'bin':  'application/vnd.openxmlformats-officedocument.oleObject',
            # Visio
            'vsd':  'application/vnd.visio',
            'vsdx': 'application/vnd.ms-visio.drawing',
            'vsdm': 'application/vnd.ms-visio.drawing.macroEnabled',
            # Excel
            'xls':  'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
            # PowerPoint
            'ppt':  'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            # Word（嵌入文档场景）
            'doc':  'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            # PDF
            'pdf':  'application/pdf',
        }

        # 同时从源文件 [Content_Types].xml 里，把被注入文件对应的 ContentType 原样复制过来
        # 优先用源文件的声明（比 ext_ct_map 的猜测更准确）
        src_ct_xml = None
        try:
            with zipfile.ZipFile(src_path, 'r') as _src_z:
                src_ct_xml = _src_z.read('[Content_Types].xml').decode('utf-8')
        except Exception:
            pass

        for info in to_inject_files.values():
            ext = info['target'].rsplit('.', 1)[-1].lower()
            if f'Extension="{ext}"' in ct_xml:
                continue  # 已存在，跳过

            # 优先从源文件的 Content_Types 里提取该扩展名的声明
            ct = None
            if src_ct_xml:
                m = re.search(
                    r'<Default\s+Extension="' + re.escape(ext) + r'"\s+ContentType="([^"]+)"',
                    src_ct_xml, re.IGNORECASE
                )
                if m:
                    ct = m.group(1)

            # 源文件没有则查内置映射表
            if ct is None:
                ct = ext_ct_map.get(ext)

            if ct:
                ct_xml = ct_xml.replace(
                    '</Types>',
                    f'<Default Extension="{ext}" ContentType="{ct}"/></Types>'
                )

        with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                name = item.filename
                if name == 'word/_rels/document.xml.rels':
                    zout.writestr(item, new_rels_xml.encode('utf-8'))
                elif name == 'word/fontTable.xml' and src_font_table is not None:
                    zout.writestr(item, src_font_table)
                elif name == 'word/styles.xml' and src_styles_xml is not None:
                    zout.writestr(item, src_styles_xml)
                elif name == '[Content_Types].xml':
                    zout.writestr(item, ct_xml.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(name))

            # 注入内部资源文件（源文件有但目标没有的）
            for rid, info in to_inject_files.items():
                zip_path = info['zip_path']
                if zip_path not in existing_names:
                    zout.writestr(zip_path, info['binary'])

    os.replace(tmp_path, out_path)


# ─────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────

def split_docx(input_path: str, output_dir: str, sections: list, target_outline_level: int = 0) -> dict:
    """
    主拆分函数

    Args:
        input_path:           原始 .docx 文件路径
        output_dir:           拆分后各章节 .docx 的存储目录
        sections:             [{"title": "...", "start_keyword": "..."}]
        target_outline_level: 要匹配的 outlineLevel（0=一级，1=二级，默认0）

    Returns:
        {"success": True, "sections": [...], "toc_range": [start, end]}
    """
    os.makedirs(output_dir, exist_ok=True)

    try:
        doc = Document(input_path)
    except Exception as e:
        return {"success": False, "error": f"无法读取文档: {e}", "sections": []}

    body = doc.element.body
    body_elems = [c for c in body if etree.QName(c.tag).localname in ('p', 'tbl')]

    if not body_elems:
        return {"success": False, "error": "文档没有可解析的内容", "sections": []}

    # Step1: 找目录范围
    toc_start, toc_end = find_toc_range(body_elems)

    # Step2: 识别目标层级的标题位置
    h1_positions = find_heading_positions(body_elems, doc, target_level=target_outline_level)

    if not h1_positions:
        return {
            "success": False,
            "error": f"未能识别到任何 outlineLevel={target_outline_level} 的标题，请检查文档样式",
            "sections": [],
            "debug": {
                "toc_range": [toc_start, toc_end],
                "total_elems": len(body_elems),
            }
        }

    # Step3: 将 AI sections 与真实标题位置匹配
    matched = match_sections_to_positions(sections, h1_positions)

    # 过滤出匹配成功的（idx != -1），计算 end
    valid = [(sec, idx, text) for sec, idx, text in matched if idx != -1]

    if not valid:
        # 所有章节都没匹配到：直接按 H1 位置全量拆分
        valid = [({'title': text, 'start_keyword': text}, idx, text)
                 for idx, text in h1_positions]

    results = []
    for k, (sec, start_idx, matched_text) in enumerate(valid):
        end_idx = valid[k + 1][1] if k + 1 < len(valid) else len(body_elems)
        title = sec.get('title') or matched_text

        try:
            blocks = body_elems[start_idx:end_idx]
            if not blocks:
                results.append({"title": title, "docx_path": None, "text": "", "error": "章节内容为空"})
                continue

            # 提取纯文本（给 AI 分类用）
            text_parts = []
            for elem in blocks:
                t = get_elem_text(elem)
                if t.strip():
                    text_parts.append(t.strip())
            text = '\n'.join(text_parts)

            # 生成安全文件名
            safe_name = ''.join(c for c in title if c.isalnum() or c in (' ', '-', '_', '（', '）', '、')).strip()
            safe_name = safe_name[:50] or f'section_{k}'
            filename = f"sec_{k:02d}_{safe_name}.docx"
            out_path = os.path.join(output_dir, filename)

            # 克隆到新文档
            new_doc = clone_blocks_to_doc(doc, blocks)
            new_doc.save(out_path)

            # Zip 后处理：注入 media 文件 + 替换 fontTable（修复图片和乱码）
            try:
                inject_media_into_docx(out_path, input_path, blocks)
            except Exception as e_inject:
                import traceback
                # 注入失败写入 error 字段但不影响其他章节
                results.append({
                    "title": title,
                    "matched_heading": matched_text,
                    "docx_path": os.path.abspath(out_path),
                    "block_range": [start_idx, end_idx],
                    "block_count": len(blocks),
                    "text": text,
                    "error": f"媒体注入失败: {e_inject}",
                })
                continue

            results.append({
                "title": title,
                "matched_heading": matched_text,
                "docx_path": os.path.abspath(out_path),
                "block_range": [start_idx, end_idx],
                "block_count": len(blocks),
                "text": text,
                "error": None,
            })
        except Exception as e:
            results.append({
                "title": title,
                "docx_path": None,
                "text": "",
                "error": str(e),
            })

    # 统计未匹配的章节
    unmatched = [sec.get('title', '') for sec, idx, _ in matched if idx == -1]

    return {
        "success": True,
        "sections": results,
        "debug": {
            "toc_range": [toc_start, toc_end],
            "h1_count": len(h1_positions),
            "unmatched_sections": unmatched,
        }
    }


# ─────────────────────────────────────────────
# CLI 入口
# ─────────────────────────────────────────────

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(json.dumps({
            "success": False,
            "error": "用法: python splitter.py <input.docx> <output_dir> <sections_json_string> [target_outline_level]"
        }, ensure_ascii=False))
        sys.exit(1)

    input_path   = sys.argv[1]
    output_dir   = sys.argv[2]
    sections_raw = sys.argv[3]
    target_level = int(sys.argv[4]) if len(sys.argv) > 4 else 0

    try:
        sections = json.loads(sections_raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"sections_json 解析失败: {e}"}, ensure_ascii=False))
        sys.exit(1)

    result = split_docx(input_path, output_dir, sections, target_outline_level=target_level)
    print(json.dumps(result, ensure_ascii=False))
