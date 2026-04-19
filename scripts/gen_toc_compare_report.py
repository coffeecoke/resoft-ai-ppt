# -*- coding: utf-8 -*-
"""
生成投标文件目录对比 Markdown 报告
"""
import sys
import os
sys.stdout.reconfigure(encoding='utf-8')

from docx import Document
import pymysql

DB_CONFIG = {
    'host': '10.168.188.118',
    'port': 3306,
    'user': 'root',
    'password': 'root123',
    'database': 'aippt_db',
    'charset': 'utf8mb4'
}

FILES = {
    '中信信托': r'E:\zhangying\目录\投标\中信信托大集中报表系统升级改造项目投标文件-正本-1205.docx',
    '天府银行': r'E:\zhangying\目录\投标\天府银行一表通建设项目-投标文件v2.2.docx',
}

HEADING_STYLES = {
    'heading 1': 1, 'heading 2': 2, 'heading 3': 3, 'heading 4': 4,
    '标题 1': 1, '标题 2': 2, '标题 3': 3, '标题 4': 4,
}

def extract_toc_from_docx(filepath):
    doc = Document(filepath)
    toc = []
    for para in doc.paragraphs:
        style_name = para.style.name if para.style else ''
        level = None
        for key, lvl in HEADING_STYLES.items():
            if key.lower() in style_name.lower():
                level = lvl
                break
        if level is None and para._p is not None:
            ppr = para._p.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr')
            if ppr is not None:
                outline = ppr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}outlineLvl')
                if outline is not None:
                    val = outline.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
                    if val is not None:
                        level = int(val) + 1
        if level is not None:
            text = para.text.strip()
            if text:
                toc.append({'level': level, 'title': text})
    return toc

def toc_to_md(toc, max_level=4):
    lines = []
    for item in toc:
        if item['level'] > max_level:
            continue
        indent = '  ' * (item['level'] - 1)
        prefix = ['', '-', '-', '-', '-'][min(item['level'], 4)]
        lines.append(f"{indent}{prefix} {item['title']}")
    return '\n'.join(lines)

def get_db_data():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    cursor.execute("""
        SELECT id, name, project_name, status, created_at
        FROM tender_documents ORDER BY created_at DESC
    """)
    tenders = cursor.fetchall()

    cursor.execute("""
        SELECT id, tender_id, parent_id, title, level, sort_order, content_status
        FROM bid_directory_items
        ORDER BY tender_id, sort_order, level
    """)
    dir_items = cursor.fetchall()

    cursor.execute("""
        SELECT bs.id, bs.bid_document_id, bs.title, bs.level, bs.sort_order,
               bd.name as doc_name
        FROM bid_sections bs
        LEFT JOIN bid_documents bd ON bs.bid_document_id = bd.id
        ORDER BY bs.bid_document_id, bs.sort_order
    """)
    sections = cursor.fetchall()

    cursor.close()
    conn.close()
    return tenders, dir_items, sections

def build_dir_tree_md(items, tender_id, max_level=4):
    """把某个 tender 的 AI 目录项组织成 markdown 树"""
    subset = [x for x in items if x['tender_id'] == tender_id]
    
    # 建立 id->item 映射
    id_map = {x['id']: x for x in subset}
    
    def render(items_list, parent_id, current_level):
        children = [x for x in items_list if x['parent_id'] == parent_id]
        children.sort(key=lambda x: x['sort_order'])
        lines = []
        for child in children:
            if child['level'] > max_level:
                continue
            indent = '  ' * (child['level'] - 1)
            status_icon = {'empty': '○', 'ai_generated': '✅', 'user_edited': '✏️'}.get(child['content_status'], '?')
            lines.append(f"{indent}- {child['title']} `{status_icon}`")
            lines.extend(render(items_list, child['id'], current_level + 1))
        return lines

    root_items = [x for x in subset if x['parent_id'] is None]
    root_items.sort(key=lambda x: x['sort_order'])
    lines = []
    for root in root_items:
        indent = '  ' * (root['level'] - 1)
        status_icon = {'empty': '○', 'ai_generated': '✅', 'user_edited': '✏️'}.get(root['content_status'], '?')
        lines.append(f"{indent}- **{root['title']}** `{status_icon}`")
        lines.extend(render(subset, root['id'], 2))
    return '\n'.join(lines) if lines else '_（暂无数据）_'

def compare_and_summary(file_toc, db_dir_items, db_sections, tender_id, doc_name_keyword):
    """对比文件目录与数据库，返回缺失和已有的条目"""
    # 从 bid_sections 中找对应文件的章节
    file_sections = [s for s in db_sections if doc_name_keyword in (s['doc_name'] or '')]
    
    all_db_titles = set()
    for item in db_dir_items:
        all_db_titles.add(item['title'].strip())
    for s in file_sections:
        all_db_titles.add(s['title'].strip())

    matched = []
    missing = []
    for item in file_toc:
        title = item['title'].strip()
        found = any(title in db_t or db_t in title for db_t in all_db_titles)
        if found:
            matched.append(item)
        else:
            missing.append(item)
    return matched, missing

def generate_report(output_path):
    print("正在提取文件目录...")
    file_tocs = {}
    for key, fpath in FILES.items():
        toc = extract_toc_from_docx(fpath)
        file_tocs[key] = toc
        print(f"  {key}: {len(toc)} 条目录项")

    print("正在查询数据库...")
    tenders, dir_items, sections = get_db_data()
    print(f"  tender_documents: {len(tenders)} 条")
    print(f"  bid_directory_items: {len(dir_items)} 条")
    print(f"  bid_sections: {len(sections)} 条")

    # 找出对应的 tender_id
    zhongxin_tender = next((t for t in tenders if '中信' in (t['project_name'] or '') or '中信' in t['name']), None)
    tianfu_tender = next((t for t in tenders if '天府' in (t['project_name'] or '') or '天府' in t['name'] or '一表通' in (t['project_name'] or '')), None)

    tender_map = {
        '中信信托': zhongxin_tender,
        '天府银行': tianfu_tender,
    }
    doc_keyword_map = {
        '中信信托': '中信信托',
        '天府银行': '天府银行',
    }

    md_lines = []
    md_lines.append("# 投标文件目录 vs AI生成目录 对比报告\n")
    md_lines.append(f"> 生成时间：2026-03-23\n")
    md_lines.append("---\n")

    project_configs = [
        ('中信信托', '中信信托大集中报表系统升级改造项目', '中信信托大集中报表系统升级改造项目投标文件-正本-1205.docx'),
        ('天府银行', '四川天府银行一表通建设项目', '天府银行一表通建设项目-投标文件v2.2.docx'),
    ]

    for key, project_name, doc_name in project_configs:
        toc = file_tocs[key]
        tender = tender_map[key]
        tender_id = tender['id'] if tender else None
        doc_kw = doc_keyword_map[key]

        md_lines.append(f"## 📁 {project_name}\n")
        md_lines.append(f"| 项目 | 值 |")
        md_lines.append(f"|---|---|")
        md_lines.append(f"| 投标文件 | `{doc_name}` |")
        md_lines.append(f"| 招标文件 | `{tender['name'] if tender else 'N/A'}` |")
        md_lines.append(f"| AI分析状态 | `{tender['status'] if tender else 'N/A'}` |")
        md_lines.append(f"| 文件实际目录项数 | **{len(toc)}** 条 |")
        ai_count = len([x for x in dir_items if x['tender_id'] == tender_id]) if tender_id else 0
        md_lines.append(f"| AI生成目录项数 | **{ai_count}** 条 |")
        md_lines.append("")

        # ── 真实文件目录 ──
        md_lines.append("### 一、真实投标文件目录\n")
        # 只取前4级，天府银行文件内容段落太多，限制到3级
        max_lv = 3 if key == '天府银行' else 4
        toc_filtered = [x for x in toc if x['level'] <= max_lv]
        md_lines.append(toc_to_md(toc_filtered, max_level=max_lv))
        md_lines.append("")
        if key == '天府银行':
            md_lines.append(f"> ⚠️ 天府银行文件共 {len(toc)} 条，含大量正文段落被识别为标题，此处仅展示前3级（共 {len(toc_filtered)} 条）\n")

        # ── AI生成目录 ──
        md_lines.append("### 二、AI生成的投标目录（bid_directory_items）\n")
        md_lines.append("> 图例：`✅` = AI已生成内容  `○` = 空（未生成）\n")
        if tender_id:
            md_lines.append(build_dir_tree_md(dir_items, tender_id, max_level=4))
        else:
            md_lines.append("_（数据库中无对应招标文件）_")
        md_lines.append("")

        # ── 章节库覆盖 ──
        file_secs = [s for s in sections if doc_kw in (s['doc_name'] or '')]
        md_lines.append("### 三、章节库（bid_sections）已入库章节\n")
        if file_secs:
            for s in file_secs:
                indent = '  ' * (s['level'] - 1)
                md_lines.append(f"{indent}- [{s['level']}] {s['title']}")
        else:
            md_lines.append("_（无）_")
        md_lines.append("")

        # ── 差距分析 ──
        matched, missing = compare_and_summary(toc_filtered, dir_items, sections, tender_id, doc_kw)
        md_lines.append("### 四、差距分析\n")
        md_lines.append(f"| 项目 | 数量 |")
        md_lines.append(f"|---|---|")
        md_lines.append(f"| 文件目录总项（≤{max_lv}级） | {len(toc_filtered)} |")
        md_lines.append(f"| 数据库中已覆盖 | ✅ {len(matched)} |")
        md_lines.append(f"| 数据库中缺失 | ❌ {len(missing)} |")
        md_lines.append(f"| 覆盖率 | **{len(matched)*100//len(toc_filtered)}%** |")
        md_lines.append("")

        # 缺失明细
        md_lines.append("#### ❌ 缺失的目录项（文件有、数据库无）\n")
        if missing:
            # 按级别分组显示
            for item in missing:
                indent = '  ' * (item['level'] - 1)
                md_lines.append(f"{indent}- [{item['level']}] {item['title']}")
        else:
            md_lines.append("_（无缺失）_")
        md_lines.append("")

        # 已覆盖
        md_lines.append("#### ✅ 已覆盖的目录项\n")
        if matched:
            for item in matched[:30]:
                indent = '  ' * (item['level'] - 1)
                md_lines.append(f"{indent}- [{item['level']}] {item['title']}")
            if len(matched) > 30:
                md_lines.append(f"\n> ... 共 {len(matched)} 条，仅展示前30条")
        md_lines.append("")
        md_lines.append("---\n")

    content = '\n'.join(md_lines)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"\n✅ 报告已生成：{output_path}")
    return content

if __name__ == '__main__':
    out = r'E:\dev-chat-ppt\docs\投标文件目录对比报告.md'
    generate_report(out)
