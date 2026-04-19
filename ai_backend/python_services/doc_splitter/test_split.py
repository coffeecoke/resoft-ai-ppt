# -*- coding: utf-8 -*-
"""直接调用 split_docx 做真实测试"""
import sys, io, json, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 添加路径
sys.path.insert(0, os.path.dirname(__file__))
from splitter import split_docx

FILE = r'E:\zhangying\招投标文件\蔡昌廷-四川天府银行一表通项目9-12\天府银行一表通建设项目-投标文件v2.2.docx'
OUT  = r'E:\temp\bid_test_split'

sections = [
    {"title": "投标函",       "start_keyword": "投标函"},
    {"title": "承诺函",       "start_keyword": "承诺函"},
    {"title": "法定代表人身份证明", "start_keyword": "法定代表人身份证明"},
    {"title": "法定代表人授权书",   "start_keyword": "法定代表人授权书"},
    {"title": "开标一览表",    "start_keyword": "开标一览表"},
    {"title": "商务及其他要求应答表", "start_keyword": "商务及其他要求应答表"},
    {"title": "投标人基本情况表", "start_keyword": "投标人基本情况表"},
    {"title": "关联情况说明",  "start_keyword": "关联情况说明"},
    {"title": "技术、服务应答表", "start_keyword": "技术、服务应答表"},
    {"title": "技术部分",      "start_keyword": "技术部分"},
    {"title": "其他材料",      "start_keyword": "其他材料"},
]

result = split_docx(FILE, OUT, sections)

print('=== 拆分结果 ===')
print(f'success: {result["success"]}')
print(f'debug: {json.dumps(result.get("debug", {}), ensure_ascii=False)}')
print()
for sec in result.get('sections', []):
    status = 'OK' if sec['error'] is None else f'ERROR: {sec["error"]}'
    docx_name = os.path.basename(sec['docx_path']) if sec['docx_path'] else 'None'
    block_range = sec.get('block_range', [])
    block_count = sec.get('block_count', 0)
    text_len = len(sec.get('text', ''))
    print(f'  [{status}] {sec["title"][:30]}')
    print(f'         matched={sec.get("matched_heading","")!r}  blocks={block_range}({block_count}) text={text_len}chars')
    print(f'         file={docx_name}')

print()
print('=== 生成的文件 ===')
if os.path.exists(OUT):
    for f in sorted(os.listdir(OUT)):
        fpath = os.path.join(OUT, f)
        size = os.path.getsize(fpath)
        print(f'  {f}  ({size//1024} KB)')
