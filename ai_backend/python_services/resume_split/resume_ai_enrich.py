# -*- coding: utf-8 -*-
"""
简历字段 AI 补缺：OpenAI 兼容接口（/v1/chat/completions）。
优先读 ai_backend/.env 中的 ai_key、ai_url、ai_model；也可用环境变量覆盖。
规则引擎已有值优先，仅填补空字段。
"""

from __future__ import annotations

import json
import os
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

_ENV_LOADED = False

_LIMITS: dict[str, int] = {
    "person_name": 80,
    "role_label": 120,
    "gender": 20,
    "age": 32,
    "education_level": 80,
    "major": 200,
    "graduate_school": 200,
    "work_years_hint": 64,
    "work_duration_text": 64,
    "phone": 50,
    "email": 120,
    "id_card": 24,
    "degree": 40,
    "employer": 200,
    "proposed_project_role": 120,
    "project_experience": 50000,
}

# 与 extract_person_structured 顶层字段一致（不含 raw_fragment / structured_json）
_PERSON_KEYS = (
    "person_name",
    "role_label",
    "gender",
    "age",
    "education_level",
    "major",
    "graduate_school",
    "work_years_hint",
    "work_duration_text",
    "phone",
    "email",
    "id_card",
    "degree",
    "employer",
    "proposed_project_role",
    "project_experience",
)


def _try_load_ai_env_file() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    try:
        text = env_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return
    for raw in text.splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if "=" not in s:
            continue
        k, _, v = s.partition("=")
        k, v = k.strip(), v.strip()
        if k in ("ai_key", "ai_url", "ai_model", "RESUME_EXTRACT_USE_AI"):
            if k not in os.environ or not (os.environ.get(k) or "").strip():
                os.environ[k] = v


def is_enrich_enabled() -> bool:
    _try_load_ai_env_file()
    flag = (os.environ.get("RESUME_EXTRACT_USE_AI") or "1").strip().lower()
    if flag in ("0", "false", "no", "off"):
        return False
    cfg = get_ai_config()
    return cfg is not None


def get_ai_config() -> dict[str, str] | None:
    _try_load_ai_env_file()
    key = (os.environ.get("ai_key") or os.environ.get("AI_KEY") or "").strip()
    url = (os.environ.get("ai_url") or os.environ.get("AI_URL") or "").strip()
    model = (os.environ.get("ai_model") or os.environ.get("AI_MODEL") or "").strip()
    if not key or not url or not model:
        return None
    return {"key": key, "url": url.rstrip("/"), "model": model}


def _is_empty(v: Any) -> bool:
    if v is None:
        return True
    if isinstance(v, str) and not v.strip():
        return True
    return False


def _parse_json_from_response(content: str) -> dict[str, Any]:
    t = (content or "").strip()
    if not t:
        return {}
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    if fence:
        t = fence.group(1).strip()
    return json.loads(t)


def _chat_completions(cfg: dict[str, str], user_message: str, timeout: int = 120) -> str:
    url = cfg["url"].rstrip("/") + "/chat/completions"
    body = {
        "model": cfg["model"],
        "messages": [
            {
                "role": "system",
                "content": "你是投标文件人员简历信息抽取助手。只依据用户给出的原文与规则 JSON 作答，不得编造电话与身份证号。仅输出一个 JSON 对象，不要 markdown。",
            },
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.1,
    }
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Bearer {cfg['key']}",
        },
        method="POST",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"HTTP {e.code}: {err_body}") from e
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("API 未返回 choices")
    msg = (choices[0].get("message") or {}).get("content") or ""
    return str(msg)


def enrich_person_row(row: dict[str, Any], raw_chunk: str) -> None:
    """
    就地合并 AI 补缺字段；失败时写入 structured_json.ai_enrich_error。
    """
    if not is_enrich_enabled():
        return
    cfg = get_ai_config()
    if not cfg:
        return
    need_any = any(_is_empty(row.get(k)) for k in _PERSON_KEYS)
    if not need_any:
        return

    rule_snapshot = {k: row.get(k) for k in _PERSON_KEYS}
    text = (raw_chunk or "")[:14000]
    user_msg = (
        "下面是投标文件中的一段「单人简历」纯文本（可能来自 Word 表格导出，格式混乱）。\n"
        "已用规则引擎得到部分字段（JSON）。请在**不编造**的前提下补全**仍为空的字段**；"
        "原文没有的字段填 null。电话、身份证号若在原文中不明确则必须填 null。\n\n"
        "规则引擎已有字段（JSON）：\n"
        + json.dumps(rule_snapshot, ensure_ascii=False)
        + "\n\n简历原文：\n---\n"
        + text
        + "\n---\n\n"
        "请只输出一个 JSON 对象，键名必须与下列完全一致，值为字符串或 null：\n"
        + ", ".join(_PERSON_KEYS)
        + "\n\n要求：\n"
        "1. 已有非空值的键不要被覆盖（模型输出用于补缺时会被程序忽略冲突）。\n"
        "2. project_experience 可为较长文本；其余字段宜简短。\n"
        "3. 仅输出 JSON。"
    )
    try:
        raw_out = _chat_completions(cfg, user_msg)
        ai_obj = _parse_json_from_response(raw_out)
        if not isinstance(ai_obj, dict):
            raise ValueError("模型返回非 JSON 对象")
        for k in _PERSON_KEYS:
            if k not in ai_obj:
                continue
            if not _is_empty(row.get(k)):
                continue
            val = ai_obj[k]
            if val is None:
                continue
            if isinstance(val, str) and not val.strip():
                continue
            lim = _LIMITS.get(k, 200)
            s = str(val).strip()
            row[k] = s[:lim]
        extra = row.get("structured_json")
        extra = dict(extra) if isinstance(extra, dict) else {}
        extra["ai_enriched"] = True
        extra.pop("ai_enrich_error", None)
        row["structured_json"] = extra if extra else None
    except Exception as e:
        extra = row.get("structured_json")
        extra = dict(extra) if isinstance(extra, dict) else {}
        extra["ai_enriched"] = False
        extra["ai_enrich_error"] = str(e)[:500]
        row["structured_json"] = extra


def enrich_section_extracted(extracted: dict[str, Any], raw_text: str) -> None:
    """章节级轻量补缺（person_name / role_title / education_hint / cert_hint）。"""
    if not is_enrich_enabled():
        return
    cfg = get_ai_config()
    if not cfg:
        return
    keys = ("person_name", "role_title", "education_hint", "cert_hint")
    if not any(_is_empty(extracted.get(k)) for k in keys):
        return
    snap = {k: extracted.get(k) for k in keys}
    text = (raw_text or "")[:8000]
    user_msg = (
        "以下为投标文件某章节纯文本及规则引擎提取结果。请仅补缺空字段，不要编造。\n\n"
        "规则结果 JSON：\n"
        + json.dumps(snap, ensure_ascii=False)
        + "\n\n原文：\n---\n"
        + text
        + "\n---\n\n"
        "只输出 JSON，键仅为：person_name, role_title, education_hint, cert_hint；无则 null。"
    )
    try:
        raw_out = _chat_completions(cfg, user_msg, timeout=90)
        ai_obj = _parse_json_from_response(raw_out)
        if not isinstance(ai_obj, dict):
            return
        for k in keys:
            if k not in ai_obj or not _is_empty(extracted.get(k)):
                continue
            v = ai_obj[k]
            if v is None or (isinstance(v, str) and not v.strip()):
                continue
            extracted[k] = str(v).strip()[:2000] if k == "education_hint" else str(v).strip()[:500]
        extracted["ai_section_enriched"] = True
    except Exception as e:
        extracted["ai_section_enrich_error"] = str(e)[:300]
