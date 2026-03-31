#!/usr/bin/env python3
"""
从原始 WAV 导出两档「正常」降规格版本（均需本机已安装 ffmpeg）。

档 L（语音档）: 16 kHz, 16-bit PCM, 单声道 — 适合 ASR / 上传体积
档 M（标准档）: 48 kHz, 16-bit PCM, 单声道 — 保持宽带采样，仅压声道与位深

用法:
  python3 scripts/audio_two_tiers.py [输入.wav]

环境变量:
  AUDIO_INPUT  覆盖默认输入路径
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

DEFAULT_INPUT = Path(
    "/Users/guandanghai/Documents/presail_video/0331-3(1)/0330-高胜-贵州银行金枢玄鉴新建.wav"
)


def _run_ffmpeg(inp: Path, outp: Path, extra: list[str]) -> None:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-y",
        "-i",
        str(inp),
        *extra,
        str(outp),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(
            f"ffmpeg 失败 ({r.returncode}): {r.stderr[-4000:] or r.stdout[-4000:]}"
        )


def main() -> int:
    raw = os.environ.get("AUDIO_INPUT", "").strip()
    inp = Path(raw) if raw else (Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT)
    inp = inp.expanduser().resolve()
    if not inp.is_file():
        print(f"输入文件不存在: {inp}", file=sys.stderr)
        return 1

    stem = inp.stem
    parent = inp.parent
    # 档 L：16k 单声道 16bit
    out_l = parent / f"{stem}_档L_16kHz_16bit_mono.wav"
    # 档 M：48k 单声道 16bit（与常见宽带语音一致）
    out_m = parent / f"{stem}_档M_48kHz_16bit_mono.wav"

    tiers = [
        ("档L 语音档 16kHz/16bit/mono", out_l, ["-ac", "1", "-ar", "16000", "-sample_fmt", "s16", "-c:a", "pcm_s16le"]),
        ("档M 标准档 48kHz/16bit/mono", out_m, ["-ac", "1", "-ar", "48000", "-sample_fmt", "s16", "-c:a", "pcm_s16le"]),
    ]

    for label, outp, args in tiers:
        print(f"正在生成 {label} -> {outp.name} ...")
        _run_ffmpeg(inp, outp, args)
        sz_mb = outp.stat().st_size / (1024 * 1024)
        print(f"  完成, 约 {sz_mb:.2f} MiB")

    print("全部完成。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
