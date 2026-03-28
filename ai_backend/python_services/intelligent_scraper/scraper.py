#!/usr/bin/env python3
"""
中国采招网 信息爬取工具
流程：登录 → 主站搜索框输入关键词 → jq_search() 打开新标签页
     → 点击"标题搜索" → 轮询搜索结果 → 逐条打开详情 → 保存 txt
"""

import asyncio
import random
import re
import os
import sys
import io
import configparser
from pathlib import Path

try:
    import wecom_notify
except ImportError:
    wecom_notify = None
from datetime import datetime
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse, unquote
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
import pdfplumber

# Windows 终端默认 GBK，强制 UTF-8
if sys.platform == "win32":
    import ctypes
    ctypes.windll.kernel32.SetConsoleOutputCP(65001)
    ctypes.windll.kernel32.SetConsoleCP(65001)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def _is_valid_chinese(s: str) -> bool:
    """判断字符串是否含有合法中文字符"""
    return any('\u4e00' <= c <= '\u9fff' for c in s)


def _decode_mojibake(s: str) -> str:
    """
    Windows Shell 传入中文参数时常见乱码场景修复。
    依次尝试多种编码组合，取第一个能还原出中文的结果。
    """
    for enc_from, enc_to in [("gbk", "utf-8"), ("utf-8", "gbk"), ("latin-1", "utf-8")]:
        try:
            fixed = s.encode(enc_from).decode(enc_to)
            if _is_valid_chinese(fixed):
                return fixed
        except Exception:
            continue
    return s


async def rand_sleep(page, lo: int = 1000, hi: int = 4000) -> None:
    """随机等待 [lo, hi] 毫秒，模拟真人操作节奏，对抗反爬检测。
    page 为 None 时降级为 asyncio.sleep。"""
    ms = random.randint(lo, hi)
    if page is not None:
        try:
            await page.wait_for_timeout(ms)
            return
        except Exception:
            pass
    await asyncio.sleep(ms / 1000)


def fix_argv_encoding() -> list[str]:
    """
    Windows PowerShell 在 GBK 代码页下传递 UTF-8 中文参数时会产生乱码。
    尝试多种策略还原；若参数本身已含正确中文则不处理。

    注意：Shell 层乱码有时无法完全修复，建议将中文关键词写入 config.ini，
    直接运行 python scraper.py（不传参数）以规避此问题。
    """
    if sys.platform != "win32":
        return sys.argv[1:]
    result = []
    for arg in sys.argv[1:]:
        if _is_valid_chinese(arg):
            result.append(arg)
        else:
            fixed = _decode_mojibake(arg)
            if fixed != arg:
                print(f"  [编码修复] {arg!r} → {fixed!r}")
            result.append(fixed)
    return result

# ======================== 读取配置文件 ========================
_CONFIG_FILE = Path(__file__).parent / "config.ini"

def _normalize_output_format(v: str) -> str:
    o = (v or "txt").strip().lower()
    return o if o in ("txt", "html", "both") else "txt"


def load_config() -> dict:
    cfg = configparser.ConfigParser()
    cfg.read(_CONFIG_FILE, encoding="utf-8")
    s = cfg["scraper"]
    raw_kws  = re.split(r"[,，]", s.get("keywords", ""))
    keywords = [kw.strip() for kw in raw_kws if kw.strip()]
    out = {
        "username":   s.get("username", ""),
        "password":   s.get("password", ""),
        "keywords":   keywords,
        "max_pages":  s.getint("max_pages", 3),
        "headless":   s.getboolean("headless", False),
        "output_dir": s.get("output_dir", "output"),
        "output_format": _normalize_output_format(s.get("output_format", "txt")),
        "slow_mo":    s.getint("slow_mo", 400),
        "start_date": s.get("start_date", "").strip(),
        "end_date":   s.get("end_date", "").strip(),
    }
    if cfg.has_section("wecom"):
        w = cfg["wecom"]
        out["wecom_enabled"] = w.getboolean("enabled", False)
        out["wecom_webhook_url"] = w.get("webhook_url", "").strip()
        out["wecom_corp_id"] = w.get("corp_id", "").strip()
        try:
            out["wecom_agent_id"] = w.getint("agent_id", 0) or None
        except (ValueError, TypeError):
            out["wecom_agent_id"] = None
        out["wecom_secret"] = w.get("secret", "").strip()
        out["wecom_to_user"] = w.get("to_user", "").strip() or None
        out["wecom_to_chatid"] = w.get("to_chatid", "").strip() or None
    else:
        out["wecom_enabled"] = False
        out["wecom_webhook_url"] = ""
        out["wecom_corp_id"] = ""
        out["wecom_agent_id"] = None
        out["wecom_secret"] = ""
        out["wecom_to_user"] = None
        out["wecom_to_chatid"] = None
    # 环境变量覆盖（供 ai_backend Node 调用时传入）
    if os.environ.get("SCRAPER_OUTPUT_DIR"):
        out["output_dir"] = os.environ.get("SCRAPER_OUTPUT_DIR").strip()
    if os.environ.get("SCRAPER_MAX_PAGES"):
        try:
            out["max_pages"] = int(os.environ.get("SCRAPER_MAX_PAGES"))
        except ValueError:
            pass
    if os.environ.get("SCRAPER_START_DATE") is not None:
        out["start_date"] = (os.environ.get("SCRAPER_START_DATE") or "").strip()
    if os.environ.get("SCRAPER_END_DATE") is not None:
        out["end_date"] = (os.environ.get("SCRAPER_END_DATE") or "").strip()
    return out

_CFG       = load_config()
LOGIN_URL  = "https://sso.bidcenter.com.cn/login/"
HOME_URL   = "https://www.bidcenter.com.cn"
USERNAME   = _CFG["username"]
PASSWORD   = _CFG["password"]
OUTPUT_DIR   = _CFG["output_dir"]
OUTPUT_FORMAT = _CFG["output_format"]
HEADLESS    = _CFG["headless"]
MAX_PAGES   = _CFG["max_pages"]
SLOW_MO     = _CFG["slow_mo"]
START_DATE  = _CFG["start_date"]
END_DATE    = _CFG["end_date"]
# ============================================================


# ─────────────────────────────────────────────────────
# 工具函数
# ─────────────────────────────────────────────────────

def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/*?:"<>|\r\n\t]', "_", name)
    return name.strip().strip("_")[:120]


def _strip_html_cell(html: str) -> str:
    """去掉单元格 HTML 标签，保留文本，合并空白。"""
    if not html:
        return ""
    # 先换行符统一，再去标签
    s = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"&nbsp;", " ", s, flags=re.I)
    s = " ".join(s.split())
    return s.strip()


def _find_table_bounds(html: str, start: int = 0):
    """从 start 起找下一个 <table>...</table> 的 (start, end) 闭区间，end 指向 '</table>' 最后一个字符。"""
    i = html.find("<table", start)
    if i == -1:
        return None
    depth = 0
    pos = i
    while pos < len(html):
        next_open = html.find("<table", pos)
        next_close = html.find("</table>", pos)
        if next_close == -1:
            return None
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 6
        else:
            depth -= 1
            pos = next_close + 8
            if depth == 0:
                return (i, pos - 1)
    return None


def _table_html_to_markdown(table_html: str) -> str:
    """将一块 table 的 HTML 转成 Markdown 表格（无表头分隔行时自动加）。"""
    rows = []
    # 找所有 <tr>...</tr>（非贪婪，避免跨多行出问题则用 DOTALL）
    tr_pat = re.compile(r"<tr[^>]*>(.*?)</tr>", re.I | re.DOTALL)
    for tr_m in tr_pat.finditer(table_html):
        tr_inner = tr_m.group(1)
        cells = []
        for tag in ("th", "td"):
            cell_pat = re.compile(rf"<{tag}[^>]*>(.*?)</{tag}>", re.I | re.DOTALL)
            for cell_m in cell_pat.finditer(tr_inner):
                cells.append(_strip_html_cell(cell_m.group(1)))
        if cells:
            rows.append(cells)
    if not rows:
        return ""
    # 统一列数（按第一行）
    ncol = max(len(r) for r in rows)
    for r in rows:
        while len(r) < ncol:
            r.append("")
    lines = []
    for i, r in enumerate(rows):
        line = "| " + " | ".join(r) + " |"
        lines.append(line)
        if i == 0:
            lines.append("| " + " | ".join(["---"] * ncol) + " |")
    return "\n".join(lines)


def html_content_to_text_with_tables(html: str) -> str:
    """
    将正文 HTML 转为纯文本，其中 <table> 转为 Markdown 表格，便于在 .txt 中保留表格形式。
    不引入额外依赖，仅用正则与字符串处理。
    """
    if not html or not html.strip():
        return ""
    # 去掉 script/style 内容，避免其中的 </table> 干扰
    cleaned = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.I | re.DOTALL)
    cleaned = re.sub(r"<style[^>]*>.*?</style>", "", cleaned, flags=re.I | re.DOTALL)
    parts = []
    pos = 0
    while True:
        bounds = _find_table_bounds(cleaned, pos)
        if bounds is None:
            break
        start, end = bounds
        # 表格前的文本
        before = cleaned[pos:start]
        before_text = re.sub(r"<[^>]+>", " ", before)
        before_text = re.sub(r"&nbsp;", " ", before_text, flags=re.I)
        before_text = " ".join(before_text.split()).strip()
        if before_text:
            parts.append(before_text)
        parts.append(_table_html_to_markdown(cleaned[start : end + 1]))
        pos = end + 1
    # 剩余部分
    rest = cleaned[pos:]
    rest_text = re.sub(r"<[^>]+>", " ", rest)
    rest_text = re.sub(r"&nbsp;", " ", rest_text, flags=re.I)
    rest_text = " ".join(rest_text.split()).strip()
    if rest_text:
        parts.append(rest_text)
    return "\n\n".join(p for p in parts if p).strip()


def extract_body_below_label(content: str, label: str = "公告正文") -> str:
    """
    只保留「公告正文」下面的内容，去掉页面导航、按钮等噪音。
    若找不到 label，则返回原内容。
    """
    if not content or label not in content:
        return content.strip()
    after = content.split(label, 1)[1].strip()
    # skip_ui 阶段（公告正文区顶部按钮区）需要过滤的 UI 行
    ui_lines = {"收藏", "分享", "分享功能升级", "我知道了", "邮箱", "导出", "打印", "内容纠错",
                "现在可以直接通过小程序码将信息分享 给好友了！", "发送到邮箱", "为你推荐", "查看更多类似项目>>",
                "返回", "列表"}
    # 实际内容开始后，遇到以下标志立即截断（推荐阅读及以下不获取）
    tail_cutoffs = {"为你推荐", "查看更多类似项目>>", "发送到邮箱", "推荐阅读", "相关推荐"}
    lines = after.split("\n")
    result = []
    skip_ui = True
    for line in lines:
        s = line.strip()
        # ⚠️ tail_cutoffs 只在实际内容开始后才截断（skip_ui=False 之后）
        # 遇到「推荐阅读」或整行在截断集合里则不再获取后面内容
        if not skip_ui and (s in tail_cutoffs or "推荐阅读" in s or "相关推荐" in s):
            break
        if skip_ui and s in ui_lines:
            continue
        if skip_ui and not s:
            continue
        if skip_ui and len(s) > 15:
            skip_ui = False
        result.append(line)
    # 去掉末尾残留的「返回」「列表」「推荐阅读」等
    tail_strip = {"返回", "列表", "发送到邮箱", "分享", "推荐阅读", "相关推荐"}
    while result and result[-1].strip() in tail_strip:
        result.pop()
    return "\n".join(result).strip()


def _strip_html_after_recommend(html: str) -> str:
    """去掉 HTML 中「推荐阅读」及之后的内容，避免保存推荐区。"""
    if not html:
        return html
    pos = -1
    for marker in ("推荐阅读", "相关推荐"):
        i = html.find(marker)
        if i != -1 and (pos == -1 or i < pos):
            pos = i
    if pos == -1:
        return html
    # 从 marker 往前找到最后一个 '>'，避免截断在标签中间
    cut = html.rfind(">", 0, pos)
    if cut != -1:
        return html[: cut + 1].strip()
    return html[:pos].strip()


def save_to_file(info_type: str, title: str, url: str, content: str,
                 out_dir: str = OUTPUT_DIR) -> str:
    """文件名 = 信息类型_标题.txt，保存到关键词子目录"""
    os.makedirs(out_dir, exist_ok=True)
    raw_name = sanitize_filename(f"{info_type}_{title}") or \
               f"document_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    filepath = os.path.join(out_dir, f"{raw_name}.txt")
    if os.path.exists(filepath):
        filepath = os.path.join(out_dir, f"{raw_name}_{datetime.now().strftime('%H%M%S')}.txt")

    header = (
        f"标题：{title}\n"
        f"类型：{info_type}\n"
        f"来源：{url}\n"
        f"抓取时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        + "=" * 60 + "\n\n"
    )
    Path(filepath).write_text(header + content, encoding="utf-8")
    print(f"    [已保存] {filepath}")
    return filepath


def save_to_html(info_type: str, title: str, url: str, content_html: str,
                 out_dir: str = OUTPUT_DIR, text_fallback: str = "") -> str:
    """保存为独立 HTML 文件，保留表格等结构。content_html 为空时用 text_fallback 包在 <pre> 里。"""
    os.makedirs(out_dir, exist_ok=True)
    raw_name = sanitize_filename(f"{info_type}_{title}") or \
               f"document_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    filepath = os.path.join(out_dir, f"{raw_name}.html")
    if os.path.exists(filepath):
        filepath = os.path.join(out_dir, f"{raw_name}_{datetime.now().strftime('%H%M%S')}.html")

    safe_title = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    fallback_escaped = (text_fallback or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    body = content_html.strip() if content_html.strip() else f"<pre>{fallback_escaped}</pre>"
    doc = (
        "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n"
        "<meta charset=\"UTF-8\">\n"
        f"<title>{safe_title}</title>\n"
        "<style>table{border-collapse:collapse;} th,td{border:1px solid #333;padding:6px 10px;} body{font-family:sans-serif;max-width:900px;margin:20px auto;}</style>\n"
        "</head>\n<body>\n"
        f"<h1>{safe_title}</h1>\n"
        f"<p><strong>类型：</strong>{info_type} &nbsp; <strong>来源：</strong><a href=\"{url}\">{url}</a></p>\n"
        f"<p><strong>抓取时间：</strong>{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>\n<hr>\n"
        f"<div class=\"article-body\">\n{body}\n</div>\n</body>\n</html>"
    )
    Path(filepath).write_text(doc, encoding="utf-8")
    print(f"    [已保存] {filepath}")
    return filepath


def fix_url(href: str) -> str:
    """把 //xxx 补全为 https://xxx"""
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("http"):
        return href
    return "https://www.bidcenter.com.cn" + href


async def safe_screenshot(page, name: str):
    try:
        await page.screenshot(path=f"{name}.png", full_page=True, timeout=8000)
        print(f"  [截图] {name}.png")
    except Exception:
        pass


# ─────────────────────────────────────────────────────
# 步骤1：登录
# ─────────────────────────────────────────────────────

async def login(page):
    """
    登录采招网 SSO
    - 用户名：#txtusername
    - 密码：  #txtpassword
    - 登录：  JS 调用 pub.loginMember()（绕过按钮遮挡）
    """
    print(f"\n{'='*52}")
    print(f"  步骤1：登录")
    await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
    await rand_sleep(page, 1000, 3000)   # 页面渲染随机等待

    await page.locator("#txtusername").fill(USERNAME)
    await rand_sleep(page, 200, 600)     # 填完用户名停顿
    await page.locator("#txtpassword").fill(PASSWORD)
    await rand_sleep(page, 300, 800)     # 填完密码停顿，模拟人工输入
    await page.evaluate("pub.loginMember()")

    try:
        await page.wait_for_url(
            lambda u: "sso.bidcenter.com.cn/login" not in u,
            timeout=25000,
        )
        print(f"  [OK] 登录成功 -> {page.url}")
    except PlaywrightTimeout:
        await safe_screenshot(page, "login_fail")
        raise RuntimeError("登录超时，请查看 login_fail.png（可能有验证码）")


# ─────────────────────────────────────────────────────
# 步骤2：主站搜索 → 获取新标签页
# ─────────────────────────────────────────────────────

async def open_search_tab(context, keyword: str):
    """
    在主站搜索框输入关键词，调用 jq_search() 打开新标签页，
    返回搜索结果标签页 page 对象。
    """
    home_page = await context.new_page()
    await home_page.goto(HOME_URL, wait_until="domcontentloaded", timeout=30000)
    await rand_sleep(home_page, 1000, 3000)   # 主页渲染随机等待

    # 监听新标签页事件（jq_search 会 window.open 新标签页）
    async with context.expect_page(timeout=15000) as new_page_info:
        await home_page.locator("#aliSearchInput").fill(keyword)
        await rand_sleep(home_page, 200, 700)  # 输入关键词后停顿
        await home_page.evaluate("jq_search()")

    search_page = await new_page_info.value
    await search_page.wait_for_load_state("domcontentloaded", timeout=20000)
    await rand_sleep(search_page, 1000, 3000)  # 搜索结果页渲染随机等待
    await home_page.close()  # 关掉主站页，节省内存

    print(f"  [OK] 搜索结果页 -> {search_page.url}")
    return search_page


# ─────────────────────────────────────────────────────
# 步骤3：点击"标题搜索"
# ─────────────────────────────────────────────────────

async def click_title_search(page):
    """
    在搜索结果页找到并点击可见的"标题搜索"按钮。
    按钮结构：<li><a href="javascript:;">标题搜索</a></li>
    点击后等待页面重新加载。
    """
    # 找所有文字为"标题搜索"的 A 标签，取第一个可见的
    clicked = False
    candidates = await page.locator("a").all()
    for a in candidates:
        try:
            txt = (await a.inner_text()).strip()
            if txt == "标题搜索" and await a.is_visible(timeout=500):
                await a.click()
                clicked = True
                print("  [OK] 已点击「标题搜索」")
                break
        except Exception:
            continue

    if not clicked:
        print("  [WARN] 未找到「标题搜索」按钮，使用默认全文搜索")
        return

    # 等待结果刷新
    await page.wait_for_load_state("networkidle", timeout=15000)
    await rand_sleep(page, 1000, 3000)   # 标题搜索结果渲染随机等待
    print(f"  [OK] 标题搜索结果页 -> {page.url}")


# ─────────────────────────────────────────────────────
# 步骤3.5：应用时间筛选
# ─────────────────────────────────────────────────────

async def apply_date_filter(page, start_date: str, end_date: str):
    """
    在当前搜索结果 URL 上追加 time=5&stime&endtime 并重新加载。
    采招网实际参数：time=5 表示「自定义时间」，stime/endtime 格式 YYYY-MM-DD。
    留空则不做任何操作。
    """
    if not start_date and not end_date:
        return

    parsed = urlparse(page.url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    # time=5 表示自定义日期范围，否则站点可能忽略 stime/endtime
    params["time"] = ["5"]
    if start_date:
        params["stime"] = [start_date]
    if end_date:
        params["endtime"] = [end_date]

    new_query = urlencode({k: v[0] for k, v in params.items()})
    new_url = urlunparse(parsed._replace(query=new_query))

    print(f"  [时间筛选] {start_date} ~ {end_date}")
    await page.goto(new_url, wait_until="networkidle", timeout=20000)
    await rand_sleep(page, 800, 2500)    # 时间筛选后渲染随机等待
    print(f"  [OK] 时间筛选已应用 -> {new_url}")


# ─────────────────────────────────────────────────────
# 步骤4：解析当前页的搜索结果列表
# ─────────────────────────────────────────────────────

async def get_result_links(page) -> list[dict]:
    """
    解析 .ssjg-list_cell 结果列表。
    每项格式：{ url, title, info_type }
    """
    # 等待结果渲染（JS 异步加载）
    try:
        await page.wait_for_selector(".ssjg-list_cell", timeout=15000)
    except PlaywrightTimeout:
        print("  [WARN] 等待结果列表超时，本页可能无数据")
        return []

    items  = await page.locator(".ssjg-list_cell").all()
    links  = []
    for item in items:
        try:
            # 信息类型
            info_type = "采招信息"
            try:
                info_type = (
                    await item.locator(".ssjg-leixing").first.inner_text(timeout=1000)
                ).strip()
            except Exception:
                pass

            # 标题链接（a.ssjg-title 有 href 和 tid 属性）
            a_tag = item.locator("a.ssjg-title").first
            href  = (await a_tag.get_attribute("href") or "").strip()
            title = (await a_tag.inner_text()).strip()

            if not href or not title:
                continue

            links.append({
                "url":       fix_url(href),
                "title":     title,
                "info_type": info_type,
            })
        except Exception as e:
            continue

    print(f"  本页找到 {len(links)} 条结果")
    return links


# ─────────────────────────────────────────────────────
# 步骤5：翻页
# ─────────────────────────────────────────────────────

async def go_next_page(page) -> bool:
    """点击下一页，返回 True 表示成功翻页"""
    for sel in [
        "a:has-text('下一页')", ".pagination .next", "li.next > a",
        "a[rel='next']", ".page-next",
    ]:
        try:
            btn = page.locator(sel).first
            if await btn.is_visible(timeout=1500):
                cls = (await btn.get_attribute("class") or "").lower()
                if "disabled" in cls or "grey" in cls:
                    break
                await btn.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                await rand_sleep(page, 1500, 5000)   # 翻页后随机等待，避免高频翻页
                return True
        except Exception:
            continue
    return False


# ─────────────────────────────────────────────────────
# PDF 工具：检测 + 下载 + 解析
# ─────────────────────────────────────────────────────

def unwrap_pdfjs_url(url: str) -> str:
    """
    检测 PDF.js 查看器 URL（viewer.html?file=...），
    提取并返回真实 PDF 文件地址。
    - file= 有值 → 返回解码后的真实 PDF URL
    - file= 为空（PDF 由 JS 动态注入）→ 返回空字符串，由调用方跳过此 URL
    - 非 viewer URL → 原样返回
    """
    if "viewer.html" in url and "file=" in url:
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        file_param = qs.get("file", [""])[0]
        if file_param:
            return unquote(file_param)
        return ""   # file= 为空，跳过这个 iframe
    return url


async def find_pdf_url(page) -> str:
    """
    在页面中查找 PDF 来源 URL，优先级：
    1. <embed src> 或 <iframe src>（URL 含 .pdf 或 content-type 为 pdf）
    2. <a href>（URL 含 .pdf）
    3. 文字链接：点击下载 / 点击查看或下载公告文件 / 下载附件 等
    4. 拦截「点击下载」按钮触发的网络请求，捕获真实 PDF URL
    返回找到的第一个有效 PDF URL，找不到返回空字符串。
    """
    # ① embed / iframe src（含 .pdf 或 viewer.html?file=有值）
    for tag, attr in [("embed", "src"), ("iframe", "src")]:
        try:
            elems = await page.locator(tag).all()
            for el in elems:
                val = (await el.get_attribute(attr) or "").strip()
                if not val:
                    continue
                if ".pdf" in val.lower() or "viewer.html" in val:
                    real = unwrap_pdfjs_url(fix_url(val))
                    if real:       # file= 为空时 unwrap 返回 ""，跳过继续找
                        return real
        except Exception:
            continue

    # ② <a href> 含 .pdf
    try:
        elems = await page.locator("a").all()
        for el in elems:
            val = (await el.get_attribute("href") or "").strip()
            if val and ".pdf" in val.lower():
                real = unwrap_pdfjs_url(fix_url(val))
                if real:
                    return real
    except Exception:
        pass

    # ③ 文字链接（不限 .pdf 后缀，外部平台链接也收录）
    download_hints = [
        "点击下载", "下载附件", "附件下载",
        "点击查看或下载公告文件", "下载公告文件", "查看公告文件", "公告附件",
    ]
    for hint in download_hints:
        try:
            el = page.locator(f"a:has-text('{hint}')").first
            if await el.is_visible(timeout=1000):
                href = (await el.get_attribute("href") or "").strip()
                if href:
                    real = unwrap_pdfjs_url(fix_url(href))
                    return real if real else fix_url(href)
        except Exception:
            continue

    # ④ 点击「点击下载」并拦截弹出的请求 URL（部分采招网附件走 JS 跳转）
    try:
        btn = page.locator("a:has-text('点击下载')").first
        if await btn.is_visible(timeout=1000):
            captured = []
            def _on_request(req):
                u = req.url
                if ".pdf" in u.lower() or "download" in u.lower():
                    captured.append(u)
            page.on("request", _on_request)
            async with page.expect_popup(timeout=5000) as popup_info:
                await btn.click()
            popup = await popup_info.value
            pdf_url_from_popup = popup.url
            await popup.close()
            page.remove_listener("request", _on_request)
            if pdf_url_from_popup and pdf_url_from_popup != "about:blank":
                return pdf_url_from_popup
            if captured:
                return captured[0]
    except Exception:
        pass

    return ""


def _parse_pdf_bytes(raw: bytes) -> str:
    """用 pdfplumber 解析 PDF 字节，返回全文文本。"""
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        pages_text = []
        for i, p in enumerate(pdf.pages, 1):
            t = p.extract_text() or ""
            if t.strip():
                pages_text.append(f"[第{i}页]\n{t.strip()}")
        return "\n\n".join(pages_text) if pages_text else "[PDF 无可提取文本，可能是扫描版图片]"


# OCR 引擎全局缓存
_ocr_engine = None


def _get_ocr_engine():
    """懒加载 RapidOCR（基于 ONNX Runtime，无 PyTorch 依赖）。"""
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            print("    [OCR] 初始化 RapidOCR...")
            _ocr_engine = RapidOCR()
            print("    [OCR] 初始化完成")
        except ImportError:
            raise RuntimeError(
                "RapidOCR 未安装，请运行：pip install rapidocr-onnxruntime"
            )
    return _ocr_engine


async def _ocr_images(captured_images: list) -> str:
    """对捕获的图片列表（bytes）执行 OCR，返回拼接文字。"""
    try:
        engine = _get_ocr_engine()
    except RuntimeError as e:
        return f"[OCR 不可用] {e}"

    import numpy as np
    from PIL import Image

    all_text = []
    for i, img_bytes in enumerate(captured_images, 1):
        print(f"    [OCR] 识别第 {i}/{len(captured_images)} 页 ...")
        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img_np = np.array(img)
            result, _ = engine(img_np)
            if result:
                page_text = "\n".join(line[1] for line in result if line[1].strip())
                if page_text:
                    all_text.append(f"[第{i}页]\n{page_text}")
        except Exception as ex:
            print(f"    [OCR] 第 {i} 页识别异常: {ex}")

    if all_text:
        print(f"    [OCR] 全部 {len(all_text)} 页识别完成")
        return "\n\n".join(all_text)
    return ""


async def _wait_for_capture(popup, captured: list, target: int, max_wait: int = 10):
    """等待 captured 列表长度达到 target，最多等 max_wait 秒。"""
    for _ in range(max_wait):
        if len(captured) >= target:
            return True
        await popup.wait_for_timeout(1000)
    return len(captured) >= target


async def _navigate_popup_page(popup, pg: int):
    """在 Aspose 查看器 popup 中翻到指定页。"""
    try:
        await popup.evaluate(f"commonFuncs.next()")
        await popup.wait_for_timeout(1500)
    except Exception:
        pass
    for sel in ["#nextBtn", "#mainRight a"]:
        try:
            btn = popup.locator(sel).first
            if await btn.is_visible(timeout=500):
                await btn.click()
                await popup.wait_for_timeout(1500)
                return
        except Exception:
            continue


async def _screenshot_popup_pages(popup, total_pages: int) -> list:
    """截图 fallback：对 Aspose 查看器每一页截图，返回 PNG bytes 列表。"""
    screenshots = []

    async def _take_one():
        """截取当前可见页面的 pageDiv 区域。"""
        for div_id in [f"pageDiv_{len(screenshots)+1}", "mainMiddle"]:
            try:
                el = popup.locator(f"#{div_id}").first
                if await el.is_visible(timeout=2000):
                    png = await el.screenshot(timeout=8000)
                    if png and len(png) > 1000:
                        return png
            except Exception:
                continue
        try:
            return await popup.screenshot(full_page=False, timeout=8000)
        except Exception:
            return None

    # 截图前彻底禁用水印：
    # 1. 关闭水印开关，阻止翻页时重新生成
    # 2. 覆盖 reSetWaterMark 为空函数，防止任何触发
    # 3. 删除已有水印 DOM
    try:
        await popup.evaluate("""(() => {
            if(typeof waterMarkConfig !== 'undefined') waterMarkConfig.showWaterMark = 'false';
            if(typeof newOpen !== 'undefined' && newOpen.reSetWaterMark) newOpen.reSetWaterMark = function(){};
            document.querySelectorAll('.mask_div').forEach(el => el.remove());
        })()""")
    except Exception:
        pass

    # 第1页
    await popup.wait_for_timeout(2000)
    shot = await _take_one()
    if shot:
        screenshots.append(shot)
        print(f"    [截图] 第 1/{total_pages} 页截图成功")

    # 翻页截图剩余页
    for pg in range(2, total_pages + 1):
        await _navigate_popup_page(popup, pg)
        await popup.wait_for_timeout(1500)
        shot = await _take_one()
        if shot:
            screenshots.append(shot)
            print(f"    [截图] 第 {pg}/{total_pages} 页截图成功")

    return screenshots


async def ocr_via_popup_click(page) -> str:
    """
    在 bidcenter 详情页上点击「点击查看或下载公告文件」等链接，
    捕获弹出的 Aspose 查看器 popup。

    两步策略：
    1. 优先拦截 readView 图片网络响应（高质量原图）
    2. 拦截失败则 fallback 到截图模式（截取 popup 页面 DOM 元素）

    全部图片/截图送 RapidOCR 识别。
    """
    hints = [
        "点击查看或下载公告文件", "查看公告文件", "下载公告文件",
        "点击下载", "附件下载",
    ]
    # 找到第一个可见的入口链接
    target_el = None
    for hint in hints:
        try:
            el = page.locator(f"a:has-text('{hint}')").first
            if await el.is_visible(timeout=1000):
                target_el = el
                print(f"    [OCR] 找到入口链接「{hint}」")
                break
        except Exception:
            continue

    if target_el is None:
        return ""

    # 只尝试一次：打开 popup → 拦截图片 → 截图 fallback → OCR
    captured: list = []
    ctx = page.context

    async def _on_ctx_resp(resp):
        url = resp.url
        if "readView" not in url and "gxOpenserviceNews" not in url:
            return
        ct = (resp.headers.get("content-type") or "").lower()
        if "html" in ct or "javascript" in ct:
            return
        try:
            data = await resp.body()
            if data and len(data) > 500:
                captured.append(data)
                print(f"    [OCR] 拦截到图片 {len(captured)}"
                      f"（{len(data)//1024}KB）")
        except Exception:
            pass

    ctx.on("response", _on_ctx_resp)

    try:
        print(f"    [OCR] 点击入口，等待 Aspose 查看器弹出...")
        async with page.expect_popup(timeout=15000) as popup_info:
            await target_el.click()

        popup = await popup_info.value
        await popup.wait_for_load_state("domcontentloaded", timeout=20000)

        popup_html = await popup.content()
        m_total = re.search(
            r'totalPageNum\s*=\s*parseInt\(["\'](\d+)["\']', popup_html
        )
        total_pages = int(m_total.group(1)) if m_total else 4
        print(f"    [OCR] Aspose 查看器共 {total_pages} 页")

        # 等第1页响应
        await _wait_for_capture(popup, captured, 1, max_wait=10)

        # 主动翻页拦截剩余页图片
        if total_pages > 1:
            print(f"    [OCR] 开始翻页加载剩余 {total_pages - 1} 页...")
            for pg in range(2, total_pages + 1):
                await _navigate_popup_page(popup, pg)
                await _wait_for_capture(popup, captured, pg, max_wait=8)
                print(f"    [OCR] 第 {pg}/{total_pages} 页 → "
                      f"已拦截 {len(captured)} 张图片")

        # 兜底等一下
        if len(captured) < total_pages:
            await _wait_for_capture(popup, captured, total_pages, max_wait=5)

        # === Fallback：网络拦截失败，改用截图 ===
        if not captured:
            print(f"    [OCR] 网络拦截未捕获图片，切换截图模式...")
            try:
                await popup.evaluate("commonFuncs.goCurrentPage(1)")
                await popup.wait_for_timeout(1500)
            except Exception:
                pass
            captured = await _screenshot_popup_pages(popup, total_pages)

        await popup.close()

    except Exception as ex:
        print(f"    [OCR] 弹窗捕获失败: {ex}")
    finally:
        ctx.remove_listener("response", _on_ctx_resp)

    if captured:
        print(f"    [OCR] 共获取 {len(captured)}/{total_pages} 张图片，开始 OCR...")
        return await _ocr_images(captured)

    return ""


async def extract_aspose_viewer_text(page, html_text: str, viewer_url: str) -> str:
    """
    降级路径：当 HTTP 直接请求返回的是 Aspose 查看器 HTML（非 PDF）时，
    用 Playwright 导航到该 URL，主动翻页 + 截图 OCR。
    """
    m_total = re.search(r'totalPageNum\s*=\s*parseInt\(["\'](\d+)["\']', html_text)
    total_pages = int(m_total.group(1)) if m_total else 4

    captured: list = []
    ctx = page.context

    async def _on_resp(resp):
        url = resp.url
        if "readView" not in url and "gxOpenserviceNews" not in url:
            return
        ct = (resp.headers.get("content-type") or "").lower()
        if "html" in ct or "javascript" in ct:
            return
        try:
            data = await resp.body()
            if data and len(data) > 500:
                captured.append(data)
                print(f"    [Aspose] 拦截到图片 {len(captured)}（{len(data)//1024}KB）")
        except Exception:
            pass

    ctx.on("response", _on_resp)
    viewer_page = await ctx.new_page()
    try:
        await viewer_page.goto(viewer_url, wait_until="domcontentloaded", timeout=25000)
        await _wait_for_capture(viewer_page, captured, 1, max_wait=15)

        for pg in range(2, total_pages + 1):
            await _navigate_popup_page(viewer_page, pg)
            await _wait_for_capture(viewer_page, captured, pg, max_wait=8)
            print(f"    [Aspose] 第 {pg}/{total_pages} 页 → 已拦截 {len(captured)} 张")

        # 截图 fallback
        if not captured:
            print(f"    [Aspose] 网络拦截未捕获图片，切换截图模式...")
            try:
                await viewer_page.evaluate("commonFuncs.goCurrentPage(1)")
                await viewer_page.wait_for_timeout(1500)
            except Exception:
                pass
            captured = await _screenshot_popup_pages(viewer_page, total_pages)
    finally:
        ctx.remove_listener("response", _on_resp)
        await viewer_page.close()

    if captured:
        print(f"    [Aspose] 共获取 {len(captured)}/{total_pages} 张图片，开始 OCR...")
        return await _ocr_images(captured)
    return ""


async def download_and_parse_pdf(page, pdf_url: str) -> str:
    """
    两步策略获取 PDF：
    步骤1：page.request.get() 直接 HTTP 请求（快，适合直链 PDF）
    步骤2：page.goto() 浏览器导航 + 响应拦截（处理 JS 重定向，如 link?target=...）
    """
    # ── 步骤1：HTTP 直接请求 ──────────────────────────────
    try:
        resp = await page.request.get(pdf_url, timeout=30000)
        content_type = (resp.headers.get("content-type") or "").lower()
        if resp.status == 200:
            raw = await resp.body()
            if raw and raw[:4] == b"%PDF":
                return _parse_pdf_bytes(raw)
    except Exception:
        pass

    # ── 步骤2：解析 link?target= 包装，提取真实 URL 直接下载 ──
    # bidcenter 的跳转链接格式：/link?target=<url_encoded_real_url>
    # 直接解码 target 参数，跳过 JS 重定向，直接请求真实地址
    print(f"    [PDF] HTTP 直请求未拿到 PDF，尝试解析 link?target= 包装...")
    try:
        parsed_link = urlparse(pdf_url)
        qs_link = parse_qs(parsed_link.query)
        target_encoded = qs_link.get("target", [""])[0]
        if target_encoded:
            target_url = unquote(target_encoded)
            print(f"    [PDF] 解码真实地址: {target_url}")
            # 模拟浏览器导航型请求头（Sec-Fetch-Mode: navigate）
            _nav_headers = {
                "Referer": "https://www.bidcenter.com.cn/",
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;"
                    "q=0.9,image/avif,image/webp,image/apng,*/*;"
                    "q=0.8,application/signed-exchange;v=b3;q=0.7"
                ),
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Site": "cross-site",
                "Upgrade-Insecure-Requests": "1",
            }
            resp2 = await page.request.get(target_url, timeout=30000, headers=_nav_headers)
            if resp2.status == 200:
                raw2 = await resp2.body()
                if raw2 and raw2[:4] == b"%PDF":
                    print(f"    [PDF] 真实地址下载成功")
                    return _parse_pdf_bytes(raw2)
                ct2_type = (resp2.headers.get('content-type') or '')[:60]
                print(f"    [PDF] 真实地址返回非PDF: {ct2_type}")
                # 检测 Aspose 图片查看器（服务器将 PDF 转为逐页图片展示）
                try:
                    html_text2 = raw2.decode("utf-8", errors="replace")
                    if "toHTML-Aspose" in html_text2 or "method=readView" in html_text2:
                        print(f"    [PDF] 检测到 Aspose 图片查看器，启动 OCR 提取...")
                        ocr_result = await extract_aspose_viewer_text(page, html_text2, target_url)
                        if ocr_result:
                            return ocr_result
                except Exception as ex2:
                    print(f"    [PDF] Aspose OCR 失败: {ex2}")
    except Exception as ex:
        print(f"    [PDF] link?target= 解析失败: {ex}")

    # ── 步骤3：expect_download 捕获 PDF 下载文件 ────────────
    # headless Chromium 收到 PDF 通常触发下载而非内嵌显示；
    # accept_downloads=True + expect_download 可捕获下载文件直接读取
    print(f"    [PDF] 尝试捕获下载文件...")
    try:
        async with page.expect_download(timeout=30000) as dl_info:
            await page.goto(pdf_url, wait_until="commit", timeout=30000)
        dl = await dl_info.value
        dl_path = await dl.path()
        if dl_path:
            raw3 = open(dl_path, "rb").read()
            if raw3 and raw3[:4] == b"%PDF":
                print(f"    [PDF] 下载捕获成功：{dl.suggested_filename}")
                return _parse_pdf_bytes(raw3)
    except Exception as ex:
        print(f"    [PDF] 下载捕获失败: {ex}")

    # ── 全部失败：保存 PDF 链接供用户手动访问 ──────────────
    return (
        f"[公告内容为 PDF 文件，自动下载失败]\n"
        f"PDF 地址：{pdf_url}\n"
        f"（请在浏览器中手动打开以上地址查看完整内容）"
    )


# ─────────────────────────────────────────────────────
# 步骤6：提取详情页内容
# ─────────────────────────────────────────────────────

async def extract_article(page, url: str) -> dict:
    """打开详情页，提取标题/信息类型/正文"""
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await rand_sleep(page, 800, 2500)    # 详情页渲染随机等待

    # 标题
    title = ""
    for sel in ["h1", ".title", ".detail-title", ".article-title", "h2"]:
        try:
            t = (await page.locator(sel).first.inner_text(timeout=2000)).strip()
            if len(t) > 3:
                title = t
                break
        except Exception:
            continue

    # 信息类型（面包屑最后一级）
    info_type = "采招信息"
    for sel in [".breadcrumb a", ".bread-crumb a", ".crumbs a", ".nav-path a"]:
        try:
            elems = await page.locator(sel).all()
            for e in elems:
                t = (await e.inner_text()).strip()
                if 2 < len(t) < 20:
                    info_type = t
            if info_type != "采招信息":
                break
        except Exception:
            continue

    # 正文（优先用 HTML 转带表格的文本，保留「基本信息」等表格形式）
    content = ""
    content_html = ""
    for sel in [
        ".article-content", ".detail-content", ".content-body",
        ".main-content", ".news-content", "#content",
        ".bid-content", ".view-content", "article", ".detail",
    ]:
        try:
            loc = page.locator(sel).first
            t = (await loc.inner_text(timeout=2000)).strip()
            if len(t) > 80:
                content = t
                try:
                    raw_html = await loc.inner_html(timeout=2000)
                    content_html = raw_html or ""
                    text_with_tables = html_content_to_text_with_tables(raw_html)
                    if text_with_tables and len(text_with_tables) >= 50:
                        content = text_with_tables
                except Exception:
                    pass
                break
        except Exception:
            continue

    if not content:
        try:
            content = await page.locator("body").inner_text()
        except Exception:
            content = ""

    # PDF 检测触发条件：
    #   1. 正文过短（<80字）
    #   2. 正文含「点击查看或下载公告文件」等 PDF 入口标志
    #      （页面 body 虽然有大量 UI 文字，但 extract_body_below_label
    #       裁剪后只剩这一行，需要在裁剪前就检测并处理 PDF）
    _pdf_hints = ["点击查看或下载公告文件", "下载公告文件", "查看公告文件",
                  "点击下载", "附件信息可下载", "下载附件"]
    _need_pdf = len(content.strip()) < 80 or any(h in content for h in _pdf_hints)
    if _need_pdf:
        # 优先：点击链接弹出 Aspose 查看器，拦截图片并 OCR
        # （session 链路完整，适合第三方 Aspose 图片查看器）
        ocr_text = await ocr_via_popup_click(page)
        if ocr_text:
            content = ocr_text
            print(f"    [OCR] popup 点击 OCR 完成，共 {len(ocr_text)} 字")
        else:
            # 降级：传统 PDF 下载解析
            pdf_url = await find_pdf_url(page)
            if pdf_url:
                print(f"    [PDF] 检测到 PDF，尝试解析: {pdf_url}")
                pdf_text = await download_and_parse_pdf(page, pdf_url)
                if pdf_text:
                    content = pdf_text
                    print(f"    [PDF] 解析完成，共 {len(pdf_text)} 字")
    if not content:
        content = "无法提取内容"

    return {
        "url":          url,
        "title":        title or "无标题",
        "info_type":    info_type,
        "content":      content,
        "content_html": content_html,
    }


# ─────────────────────────────────────────────────────
# 单关键词完整爬取
# ─────────────────────────────────────────────────────

async def scrape_keyword(keyword: str, context, out_dir: str, max_pages: int,
                         start_date: str = "", end_date: str = ""):
    """
    完整流程：
    1. 主站搜索框 → jq_search() → 新标签页
    2. 点击「标题搜索」
    3. 逐页解析结果 → 每条开新标签页提取内容 → 保存文件
    """
    print(f"\n{'─'*52}")
    print(f"  关键词：「{keyword}」  输出目录：{out_dir}/")

    # 2. 打开搜索结果标签页
    search_page = await open_search_tab(context, keyword)

    # 3. 点击「标题搜索」
    await click_title_search(search_page)

    # 3.5 应用时间筛选
    await apply_date_filter(search_page, start_date, end_date)

    saved_count  = 0
    failed_count = 0

    for page_no in range(1, max_pages + 1):
        print(f"\n  [第 {page_no} 页]")

        # 4. 解析当前页列表
        links = await get_result_links(search_page)
        if not links:
            print("  无结果，停止翻页。")
            break

        # 5. 逐条打开详情
        for idx, item in enumerate(links, 1):
            url       = item["url"]
            title     = item["title"]
            info_type = item["info_type"]
            print(f"\n  [{idx}/{len(links)}] {title[:45]}")

            detail = await context.new_page()
            try:
                article = await extract_article(detail, url)
                final_type = info_type if info_type != "采招信息" else article["info_type"]
                save_title = title if title else article["title"]
                body_content = extract_body_below_label(article["content"])
                body_html = _strip_html_after_recommend(article.get("content_html") or "")
                if OUTPUT_FORMAT in ("txt", "both"):
                    save_to_file(final_type, save_title, url, body_content, out_dir)
                if OUTPUT_FORMAT in ("html", "both"):
                    save_to_html(final_type, save_title, url, body_html, out_dir, text_fallback=body_content)
                saved_count += 1
                # 企业微信推送（若已启用且配置有效）
                if wecom_notify and _CFG.get("wecom_enabled"):
                    wh = _CFG.get("wecom_webhook_url") or None
                    app_ok = (
                        _CFG.get("wecom_corp_id")
                        and _CFG.get("wecom_agent_id")
                        and _CFG.get("wecom_secret")
                        and (_CFG.get("wecom_to_user") or _CFG.get("wecom_to_chatid"))
                    )
                    if wh or app_ok:
                        wecom_notify.notify_scrape_result(
                            final_type,
                            save_title,
                            url,
                            body_content,
                            webhook_url=wh,
                            app_corp_id=_CFG.get("wecom_corp_id") or None,
                            app_agent_id=_CFG.get("wecom_agent_id"),
                            app_secret=_CFG.get("wecom_secret") or None,
                            app_touser=_CFG.get("wecom_to_user"),
                            app_chatid=_CFG.get("wecom_to_chatid"),
                        )
            except Exception as e:
                print(f"    [FAIL] {e}")
                failed_count += 1
            finally:
                await detail.close()

            # 每条详情页抓取完后随机停顿，模拟真人浏览间隔
            await rand_sleep(search_page, 1000, 4000)

        # 6. 翻页
        if page_no < max_pages:
            has_next = await go_next_page(search_page)
            if not has_next:
                print("\n  没有下一页，本关键词爬取完毕。")
                break

    await search_page.close()
    print(f"\n  「{keyword}」完成：成功 {saved_count} 篇，失败 {failed_count} 篇")
    return saved_count, failed_count


# ─────────────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────────────

async def scrape(keywords: list[str], max_pages: int = MAX_PAGES,
                 start_date: str = START_DATE, end_date: str = END_DATE):
    date_range = f"{start_date} ~ {end_date}" if (start_date or end_date) else "不限"
    print(f"\n{'='*52}")
    print(f"  采招网信息爬取工具（标题搜索）")
    print(f"  关键词：{keywords}")
    print(f"  时间范围：{date_range}")
    print(f"  每词最多 {max_pages} 页  |  输出格式：{OUTPUT_FORMAT}  |  根目录：{OUTPUT_DIR}/")
    print(f"{'='*52}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=HEADLESS, slow_mo=SLOW_MO)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            accept_downloads=True,   # 允许捕获 PDF 下载
        )
        main_page = await context.new_page()

        try:
            # 1. 只登录一次
            await login(main_page)
            await main_page.close()  # 登录完就不需要了

            total_saved  = 0
            total_failed = 0

            for i, kw in enumerate(keywords, 1):
                print(f"\n{'='*52}")
                print(f"  [{i}/{len(keywords)}] 关键词：「{kw}」")
                kw_dir = os.path.join(OUTPUT_DIR, sanitize_filename(kw))
                saved, failed = await scrape_keyword(kw, context, kw_dir, max_pages,
                                                     start_date, end_date)
                total_saved  += saved
                total_failed += failed
                # 关键词之间随机停顿，避免连续高频请求
                if i < len(keywords):
                    await rand_sleep(context.pages[-1] if context.pages else None,
                                     2000, 6000)

            print(f"\n{'='*52}")
            print(f"  [完成] 全部关键词爬取结束！")
            print(f"  关键词数：{len(keywords)} 个")
            print(f"  成功保存：{total_saved} 篇")
            print(f"  失败跳过：{total_failed} 篇")
            print(f"  输出根目录：{os.path.abspath(OUTPUT_DIR)}/")
            print(f"{'='*52}\n")

        except Exception as exc:
            print(f"\n  [ERROR] {exc}")
            try:
                p = context.pages[-1] if context.pages else None
                if p:
                    await safe_screenshot(p, "error_snapshot")
            except Exception:
                pass
            raise
        finally:
            await browser.close()


# ─────────────────────────────────────────────────────
# 入口
# ─────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1:
        raw_args = fix_argv_encoding()
        keywords = [k.strip() for k in re.split(r"[,，]", " ".join(raw_args)) if k.strip()]
    else:
        keywords = _CFG["keywords"]

    if not keywords:
        keywords = ["招标公告"]

    print(f"将依次爬取 {len(keywords)} 个关键词：{keywords}")
    asyncio.run(scrape(keywords, _CFG["max_pages"]))
