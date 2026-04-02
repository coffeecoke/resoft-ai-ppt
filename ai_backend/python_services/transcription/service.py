"""
讯飞语音转文本服务模块
提供统一的接口供Node.js调用
"""
import json
import os
import subprocess
import sys
from pathlib import Path

# 添加当前目录到路径，以便导入 xfyun_client
sys.path.insert(0, os.path.dirname(__file__))

# 导入转录模块（从同一目录）
import xfyun_client

def parse_dialogues(content):
    """
    解析转录文本为对话列表
    
    Args:
        content: 转录文本内容
        
    Returns:
        list: 对话列表，每项包含 timeRange, speaker, text
    """
    dialogues = []
    lines = content.split('\n')
    
    for line in lines:
        line = line.strip()
        # 匹配格式: [00:00-00:05] SPEAKER_1: 你好
        if line.startswith('[') and 'SPEAKER_' in line:
            try:
                # 分割时间范围和内容
                parts = line.split('] ', 1)
                if len(parts) < 2:
                    continue
                    
                time_range = parts[0][1:]  # 去掉开头的 [
                speaker_text = parts[1]
                
                # 分割说话人和文本
                if ': ' in speaker_text:
                    speaker, text = speaker_text.split(': ', 1)
                    dialogues.append({
                        "timeRange": time_range,
                        "speaker": speaker,
                        "text": text.strip()
                    })
            except Exception as e:
                # 解析单行失败，跳过
                continue
    
    return dialogues

def extract_full_text(dialogues):
    """
    从对话列表提取完整文本（用于搜索）
    
    Args:
        dialogues: 对话列表
        
    Returns:
        str: 完整文本
    """
    return ' '.join([d['text'] for d in dialogues if d.get('text')])

def get_audio_duration_seconds_from_file(audio_path):
    """
    用 ffprobe 读音频/视频文件的实际时长（秒，四舍五入为整数，与库字段一致）。
    不依赖讯飞结果。未安装 ffprobe 或解析失败时返回 None。
    可通过环境变量 FFPROBE_PATH 指定可执行文件路径（默认 ffprobe，通常与 ffmpeg 同目录）。
    """
    bin_name = (os.environ.get("FFPROBE_PATH") or "").strip() or "ffprobe"
    try:
        completed = subprocess.run(
            [
                bin_name,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return None
    if completed.returncode != 0:
        return None
    line = (completed.stdout or "").strip()
    if not line:
        return None
    try:
        sec = float(line)
        if sec < 0 or sec != sec:  # NaN
            return None
        return int(round(sec))
    except ValueError:
        return None


def get_audio_duration_from_dialogues(dialogues):
    """
    从对话列表中提取音频时长（兜底：仅当 ffprobe 不可用时使用）
    
    Args:
        dialogues: 对话列表
        
    Returns:
        int: 音频时长（秒），如果无法提取则返回None
    """
    if not dialogues:
        return None
    
    try:
        # 获取最后一个对话的结束时间
        last_time_range = dialogues[-1]['timeRange']
        # 格式: 01:23-01:30
        end_time = last_time_range.split('-')[1].strip()
        # 解析 mm:ss
        parts = end_time.split(':')
        minutes = int(parts[0])
        seconds = int(parts[1])
        return minutes * 60 + seconds
    except:
        return None

def main():
    """
    主函数：接收音频文件路径，返回JSON结果
    """
    if len(sys.argv) < 2:
        result = {
            "success": False,
            "error": "缺少音频文件路径参数"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    audio_file = sys.argv[1].strip()
    
    # 验证文件存在
    if not os.path.exists(audio_file):
        result = {
            "success": False,
            "error": f"音频文件不存在: {audio_file}"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    # 优先用文件本身时长（ffprobe），与讯飞识别内容无关
    duration_from_file = get_audio_duration_seconds_from_file(audio_file)
    
    try:
        # 调用转录函数（来自 xfyun_client.py）
        result_file = xfyun_client.transcribe_audio(audio_file)
        
        if not result_file or not os.path.exists(result_file):
            result = {
                "success": False,
                "error": "转录失败，未生成结果文件"
            }
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        # 读取转录结果文件
        with open(result_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析对话记录
        dialogues = parse_dialogues(content)
        
        if not dialogues:
            result = {
                "success": False,
                "error": "转录成功但未提取到对话内容"
            }
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        # 提取完整文本
        full_text = extract_full_text(dialogues)
        
        # 音频时长：优先 ffprobe 读文件；若无 ffprobe 再尝试从对白时间戳推断
        duration = duration_from_file
        if duration is None:
            duration = get_audio_duration_from_dialogues(dialogues)
        
        # 统计说话人数量
        speakers = set([d['speaker'] for d in dialogues])
        speaker_count = len(speakers)
        
        # 获取音频文件信息
        audio_size = os.path.getsize(audio_file)
        audio_format = os.path.splitext(audio_file)[1][1:].lower()  # 去掉点号
        
        # 返回成功结果
        result = {
            "success": True,
            "data": {
                "resultFilePath": result_file,
                "dialogues": dialogues,
                "fullText": full_text,
                "speakerCount": speaker_count,
                "audioDuration": duration,
                "audioFileSize": audio_size,
                "audioFormat": audio_format
            }
        }
        
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
        
    except Exception as e:
        import traceback
        result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()

