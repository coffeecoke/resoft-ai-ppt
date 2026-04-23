"""
分析指定 WAV 文件的音频参数（RIFF/WAVE 头解析 + 可选 ffprobe 对照）。

默认待测文件路径可通过环境变量 TEST_WAV_PATH 覆盖。
"""
from __future__ import annotations

import json
import os
import struct
import subprocess
import unittest
from dataclasses import dataclass
from pathlib import Path


# 用户提供的示例文件（本机路径；CI 上可不存在）
DEFAULT_WAV_PATH = Path(
    "/Users/guandanghai/Documents/presail_video/0331-3(1)/0330-高胜-贵州银行金枢玄鉴新建.wav"
)


@dataclass(frozen=True)
class WavAudioInfo:
    """从 WAV 头解析出的核心音频参数。"""

    audio_format: int  # 1 = PCM
    num_channels: int
    sample_rate: int
    byte_rate: int
    block_align: int
    bits_per_sample: int
    data_bytes: int
    file_size_bytes: int

    @property
    def duration_seconds(self) -> float:
        if self.byte_rate <= 0:
            return 0.0
        return self.data_bytes / self.byte_rate

    @property
    def bit_rate_bps(self) -> int:
        return self.byte_rate * 8


def parse_wav_audio_info(path: Path) -> WavAudioInfo:
    """
    仅读取 WAV 的 fmt 与 data 块头，不整文件读入内存。
    支持常见 PCM（含 24-bit）；fmt 块可带扩展字段，前 16 字节为标准 PCMWAVEFORMAT。
    """
    path = path.resolve()
    file_size = path.stat().st_size
    with path.open("rb") as f:
        riff = f.read(12)
        if len(riff) < 12 or riff[:4] != b"RIFF" or riff[8:12] != b"WAVE":
            raise ValueError("不是 RIFF/WAVE 文件")

        fmt_body: bytes | None = None
        data_size: int | None = None

        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            chunk_id = hdr[:4]
            chunk_size = int.from_bytes(hdr[4:8], "little")

            if chunk_id == b"fmt ":
                fmt_body = f.read(chunk_size)
                if chunk_size % 2 == 1:
                    f.read(1)
            elif chunk_id == b"data":
                data_size = chunk_size
                break
            else:
                f.seek(chunk_size, os.SEEK_CUR)
                if chunk_size % 2 == 1:
                    f.read(1)

        if fmt_body is None or len(fmt_body) < 16:
            raise ValueError("缺少有效的 fmt 块")
        if data_size is None:
            raise ValueError("缺少 data 块")

        (
            audio_format,
            num_channels,
            sample_rate,
            byte_rate,
            block_align,
            bits_per_sample,
        ) = struct.unpack_from("<HHIIHH", fmt_body, 0)

        return WavAudioInfo(
            audio_format=audio_format,
            num_channels=num_channels,
            sample_rate=sample_rate,
            byte_rate=byte_rate,
            block_align=block_align,
            bits_per_sample=bits_per_sample,
            data_bytes=data_size,
            file_size_bytes=file_size,
        )


def ffprobe_json(path: Path) -> dict | None:
    """若系统存在 ffprobe，返回 streams[0] 与 format 的 JSON；否则 None。"""
    try:
        out = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0 or not out.stdout.strip():
        return None
    return json.loads(out.stdout)


class TestWavAudioParams(unittest.TestCase):
    """针对指定 WAV 的音频参数断言（基于此前 ffprobe 实测结果）。"""

    @classmethod
    def setUpClass(cls):
        raw = os.environ.get("TEST_WAV_PATH", "").strip()
        cls.wav_path = Path(raw) if raw else DEFAULT_WAV_PATH

    def setUp(self):
        if not self.wav_path.is_file():
            self.skipTest(f"测试音频不存在，跳过: {self.wav_path}")

    def test_parse_wav_header(self):
        info = parse_wav_audio_info(self.wav_path)
        # 与 ffprobe 实测一致：PCM、48kHz、立体声、24bit
        self.assertEqual(info.audio_format, 1, "应为 WAVE_FORMAT_PCM(1)")
        self.assertEqual(info.num_channels, 2)
        self.assertEqual(info.sample_rate, 48000)
        self.assertEqual(info.bits_per_sample, 24)
        self.assertEqual(info.block_align, 6)  # 2 * (24/8)
        self.assertEqual(info.byte_rate, 288000)  # 48000 * 6
        self.assertEqual(info.bit_rate_bps, 2304000)
        # 时长约 51 分 13 秒（允许小数误差）
        self.assertGreater(info.duration_seconds, 3070)
        self.assertLess(info.duration_seconds, 3076)
        self.assertGreater(info.file_size_bytes, 800_000_000)

    def test_print_summary_for_manual_review(self):
        """运行 unittest 时可在详细模式下看到人类可读摘要。"""
        info = parse_wav_audio_info(self.wav_path)
        lines = [
            f"文件: {self.wav_path}",
            f"文件大小: {info.file_size_bytes / (1024 * 1024):.2f} MiB",
            f"编码格式: PCM (format={info.audio_format})",
            f"采样率: {info.sample_rate} Hz",
            f"声道数: {info.num_channels}",
            f"位深: {info.bits_per_sample} bit",
            f"块对齐 block_align: {info.block_align}",
            f"字节速率 byte_rate: {info.byte_rate} B/s",
            f"码率(估算): {info.bit_rate_bps} bps",
            f"data 区大小: {info.data_bytes / (1024 * 1024):.2f} MiB",
            f"时长(由 data/byte_rate): {info.duration_seconds:.3f} s",
        ]
        self.assertTrue(lines)
        # unittest -v 会打印子测试说明；这里用 addCleanup 在通过后打印一次
        print("\n" + "\n".join(lines))

    def test_ffprobe_consistency_if_available(self):
        data = ffprobe_json(self.wav_path)
        if data is None:
            self.skipTest("未安装 ffprobe 或调用失败，跳过对照")
        streams = data.get("streams") or []
        self.assertTrue(streams, "ffprobe 无 streams")
        s0 = streams[0]
        info = parse_wav_audio_info(self.wav_path)
        self.assertEqual(int(s0.get("sample_rate", 0)), info.sample_rate)
        self.assertEqual(int(s0.get("channels", 0)), info.num_channels)
        self.assertEqual(int(s0.get("bits_per_sample", 0)), info.bits_per_sample)
        dur = float(data.get("format", {}).get("duration", 0))
        self.assertAlmostEqual(dur, info.duration_seconds, delta=0.05)


if __name__ == "__main__":
    unittest.main(verbosity=2)
