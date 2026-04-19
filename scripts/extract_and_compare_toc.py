# -*- coding: utf-8 -*-
"""
提取投标文件目录，并与数据库中AI生成的目录对比
"""
import sys
import os
sys.stdout.reconfigure(encoding='utf-8')

from docx import Document
import pymysql
import json

DB_CONFIG = {
    'host': '10.168.188.118',
    'port': 3306,
    'user': 'root',
    'password': 'root123',
    'database': 'aippt_db',
    'charset': 'utf8mb4'
}

FILES = [
    r'E:\zhangying\目录\投标\中信信托大集中报表系统升级改造项目投标文件-正本-1205.docx',
    r'E:\zhangying\目录\投标\天府银行一表通建设项目-投标文件v2.2.docx',
]

HEADING_STYLES = {
    'Heading 1': 1, 'Heading 2': 2, 'Heading 3': 3, 'Heading 4': 4,
    '标题 1': 1, '标题 2': 2, '标题 3': 3, '标题 4': 4,
    'heading 1': 1, 'heading 2': 2, 'heading 3': 3,
    '1': 1, '2': 2, '3': 3, '4': 4,
}


def extract_toc_from_docx(filepath):
    """从 docx 文件中提取目录（标题段落）"""
    doc = Document(filepath)
    toc = []
    for para in doc.paragraphs:
        style_name = para.style.name if para.style else ''
        level = None
        # 通过样式名识别标题级别
        for key, lvl in HEADING_STYLES.items():
            if key.lower() in style_name.lower():
                level = lvl
                break
        # 通过大纲级别识别（outline_level: 0=h1, 1=h2 ...）
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


def print_toc(toc, label):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    for item in toc:
        indent = '  ' * (item['level'] - 1)
        marker = ['', '■', '□', '▷', '·'][min(item['level'], 4)]
        print(f"{indent}{marker} [{item['level']}] {item['title']}")
    print(f"\n  共 {len(toc)} 条目录项")


def get_db_bid_directories():
    """从数据库获取所有AI生成的投标目录项"""
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    # 查询tender_documents（招标文件及其AI生成目录）
    cursor.execute("""
        SELECT id, name, project_name, status, created_at,
               JSON_LENGTH(directory_json) as dir_count
        FROM tender_documents
        ORDER BY created_at DESC
        LIMIT 20
    """)
    tenders = cursor.fetchall()

    # 查询bid_directory_items（AI生成的投标目录项）
    cursor.execute("""
        SELECT bdi.id, bdi.tender_id, bdi.title, bdi.level, bdi.sort_order,
               bdi.section_type, bdi.content_status,
               td.name as tender_name, td.project_name
        FROM bid_directory_items bdi
        LEFT JOIN tender_documents td ON bdi.tender_id = td.id
        WHERE bdi.parent_id IS NULL OR bdi.level <= 3
        ORDER BY bdi.tender_id, bdi.sort_order, bdi.level
        LIMIT 500
    """)
    dir_items = cursor.fetchall()

    # 查询bid_sections（已有投标文件拆分的章节）
    cursor.execute("""
        SELECT bs.id, bs.title, bs.level, bs.sort_order, bs.section_type,
               bd.name as doc_name, bd.source_info
        FROM bid_sections bs
        LEFT JOIN bid_documents bd ON bs.bid_document_id = bd.id
        ORDER BY bs.bid_document_id, bs.sort_order
        LIMIT 500
    """)
    sections = cursor.fetchall()

    cursor.close()
    conn.close()
    return tenders, dir_items, sections


def compare_toc(file_toc, db_items, file_label):
    """简单对比：看哪些目录标题在DB中有对应章节"""
    print(f"\n{'='*60}")
    print(f"  对比分析: {file_label}")
    print(f"{'='*60}")

    db_titles = set(item['title'].strip() for item in db_items)

    matched = []
    missing = []
    for item in file_toc:
        title = item['title'].strip()
        found = any(title in db_t or db_t in title for db_t in db_titles)
        if found:
            matched.append(item)
        else:
            missing.append(item)

    print(f"\n✅ 文件中有、数据库也有（{len(matched)} 项）:")
    for m in matched[:20]:
        print(f"   {'  '*(m['level']-1)}[{m['level']}] {m['title']}")

    print(f"\n❌ 文件中有、数据库中缺失（{len(missing)} 项）:")
    for m in missing[:50]:
        print(f"   {'  '*(m['level']-1)}[{m['level']}] {m['title']}")

    if len(missing) > 50:
        print(f"   ... 还有 {len(missing)-50} 项未显示")

    return matched, missing


def main():
    print("=" * 60)
    print("  投标文件目录提取 & 数据库对比工具")
    print("=" * 60)

    # 1. 提取文件目录
    all_file_tocs = []
    for fpath in FILES:
        fname = os.path.basename(fpath)
        print(f"\n📄 正在提取: {fname}")
        try:
            toc = extract_toc_from_docx(fpath)
            all_file_tocs.append((fname, toc))
            print_toc(toc, fname)
        except Exception as e:
            print(f"  ❌ 提取失败: {e}")

    # 2. 查询数据库
    print("\n\n" + "=" * 60)
    print("  📦 数据库中的投标相关数据")
    print("=" * 60)

    try:
        tenders, dir_items, sections = get_db_bid_directories()

        print(f"\n【招标文件（tender_documents）】共 {len(tenders)} 条:")
        for t in tenders:
            print(f"  - {t['name']} | 项目: {t['project_name']} | 状态: {t['status']} | 目录项数: {t['dir_count']}")

        print(f"\n【AI生成投标目录项（bid_directory_items）】共 {len(dir_items)} 条:")
        for item in dir_items[:80]:
            indent = '  ' * (item['level'] - 1)
            print(f"  {indent}[{item['level']}] {item['title']}  ({item['content_status']})")
        if len(dir_items) > 80:
            print(f"  ... 还有 {len(dir_items)-80} 项未显示")

        print(f"\n【已有投标章节库（bid_sections）】共 {len(sections)} 条:")
        for s in sections[:50]:
            print(f"  [{s['level']}] {s['title']}  来源: {s['doc_name']}")
        if len(sections) > 50:
            print(f"  ... 还有 {len(sections)-50} 项未显示")

        # 3. 对比分析
        if all_file_tocs:
            all_db_titles = list(dir_items) + list(sections)
            for fname, toc in all_file_tocs:
                compare_toc(toc, all_db_titles, fname)

    except Exception as e:
        import traceback
        print(f"\n❌ 数据库查询失败: {e}")
        traceback.print_exc()
        print("\n仅输出文件目录结果（跳过对比）")


if __name__ == '__main__':
    main()
