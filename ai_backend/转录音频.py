"""
讯飞音频转录脚本
"""
import json
import logging
import os
import sys
import time
from pathlib import Path

# 添加SDK路径
sys.path.insert(0, os.path.dirname(__file__))

from xfyunsdkspeech.lfasr_client import LFasrClient
from xfyunsdkcore.model.lfasr_model import UploadParam

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 讯飞 getResult 限频：100012 = access too fast
XFYUN_ERR_QUERY_TOO_FAST = "100012"
POLL_INTERVAL_SEC = 8
UPLOAD_TO_FIRST_QUERY_DELAY_SEC = 3

# 讯飞API凭证
APP_ID = "30fb0f0d"
API_KEY = "8a96101efefbab3880e7e491b78139de"
API_SECRET = "704fdea92fb9c8cec33d9f5705a06b69"


def _ai_backend_root():
    """本脚本位于 ai_backend 根目录。"""
    return Path(__file__).resolve().parent


def get_xunfei_output_dir():
    """讯飞原始 JSON / 默认 TXT 输出目录。未设置环境变量时为 <ai_backend>/data/xunfei_transcripts（跨平台）。"""
    custom = (os.environ.get("XUNFEI_TRANSCRIPT_OUTPUT_DIR") or "").strip()
    if custom:
        return os.path.expanduser(custom)
    return str(_ai_backend_root() / "data" / "xunfei_transcripts")


def get_xunfei_txt_output_dir(audio_file):
    """TXT：Windows 下若音频在 E: 盘则写入 E 盘目录，否则与 get_xunfei_output_dir 一致。"""
    p = Path(audio_file)
    if p.drive and p.drive.upper() == "E:":
        e_custom = (os.environ.get("XUNFEI_TRANSCRIPT_E_DRIVE_OUTPUT_DIR") or "").strip()
        if e_custom:
            return os.path.expanduser(e_custom)
        return r"E:\已转录"
    return get_xunfei_output_dir()


def transcribe_audio(audio_file):
    """转录音频文件"""
    
    # 初始化客户端（讯飞语音转写使用 secret_key，对应 APISecret）
    client = LFasrClient(
        app_id=APP_ID,
        secret_key=API_SECRET,  # 使用 APISecret 作为 secret_key（不是 APIKey）
    )

    try:
        # 1. 上传文件
        logger.info("=" * 80)
        logger.info("开始上传音频文件...")
        logger.info("=" * 80)
        
        file_size = os.path.getsize(audio_file) / (1024 * 1024)
        logger.info(f"文件: {os.path.basename(audio_file)}")
        logger.info(f"大小: {file_size:.1f} MB")
        
        # 参数准备 - 启用角色分离配置
        param = UploadParam(
            audioMode="fileStream",
            fileName=os.path.basename(audio_file),
            fileSize=os.path.getsize(audio_file),
        )
        
        # 转换为字典，然后手动添加角色分离参数
        param_dict = param.to_dict()
        param_dict['has_seperate'] = 'true'      # ⭐ 启用角色分离（包含时间戳）
        param_dict['speaker_number'] = '0'       # ⭐ 说话人数量（0=自动识别）
        param_dict['roleType'] = '1'             # ⭐ 角色分离类型（1=通用，2=电话）
        
        logger.info("⚙️  转录配置: 角色分离模式（has_seperate=true, speaker_number=0, roleType=1）")
        
        upload_resp = client.upload(param_dict, audio_file)
        upload_data = json.loads(upload_resp)
        
        if upload_data["code"] != "000000":
            logger.error(f"❌ 上传失败: {upload_data}")
            return None
            
        logger.info(f"✅ 上传成功")
        
        orderId = upload_data["content"]["orderId"]
        logger.info(f"订单ID: {orderId}")
        
        # 2. 查询结果
        logger.info("=" * 80)
        logger.info("等待转录完成...")
        logger.info("=" * 80)
        
        time.sleep(UPLOAD_TO_FIRST_QUERY_DELAY_SEC)
        
        status = 3
        check_count = 0
        too_fast_streak = 0
        
        # 建议使用回调的方式查询结果，查询接口有请求频率限制
        while status == 3:
            check_count += 1
            param = {"orderId": orderId}
            result_resp = client.get_result(param)
            result_data = json.loads(result_resp)
            
            if result_data["code"] != "000000":
                if result_data.get("code") == XFYUN_ERR_QUERY_TOO_FAST:
                    too_fast_streak += 1
                    wait_sec = min(60, 3 * (2 ** min(too_fast_streak - 1, 4)))
                    logger.warning(
                        "⚠️ 查询过于频繁(100012)，%s 秒后重试（第 %s 次）",
                        wait_sec,
                        too_fast_streak,
                    )
                    time.sleep(wait_sec)
                    continue
                logger.error(f"❌ 查询失败: {result_data}")
                break
            
            too_fast_streak = 0
                
            status = result_data['content']['orderInfo']['status']
            
            if status == 0:
                logger.info(f"[{check_count}] 订单已创建，等待处理中...")
            elif status == 3:
                logger.info(f"[{check_count}] 转录进行中，请稍候...")
            elif status == 4:
                logger.info("=" * 80)
                logger.info("✅ 转录完成！")
                logger.info("=" * 80)
                
                orderResult = result_data['content']['orderResult']
                order_data = json.loads(orderResult)
                
                # 保存结果
                output_file = save_result(audio_file, order_data)
                logger.info(f"结果已保存到: {output_file}")
                
                # 同时保存原始JSON数据
                json_file = save_json_result(audio_file, order_data)
                logger.info(f"原始JSON已保存到: {json_file}")
                
                # 打开结果文件
                os.system(f'notepad "{output_file}"')
                
                return output_file
                
            elif status == -1:
                failType = result_data['content']['orderInfo']['failType']
                logger.error(f"❌ 转录失败: {orderId}, 失败类型: {failType}")
                break
                
            time.sleep(POLL_INTERVAL_SEC)
            
    except Exception as e:
        logger.error(f"❌ 发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def save_json_result(audio_file, order_data):
    """保存原始JSON结果"""
    output_dir = get_xunfei_output_dir()
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成输出文件名
    base_name = os.path.splitext(os.path.basename(audio_file))[0]
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"{base_name}_讯飞转录_原始数据_{timestamp}.json")
    
    # 保存JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(order_data, f, ensure_ascii=False, indent=2)
    
    return output_file

def save_result(audio_file, order_data):
    """保存转录结果"""
    output_dir = get_xunfei_txt_output_dir(audio_file)
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成输出文件名
    base_name = os.path.splitext(os.path.basename(audio_file))[0]
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"{base_name}_转录.txt")
    
    # 格式化输出
    lines = []
    lines.append("=" * 80)
    lines.append("讯飞音频文件语音转写结果")
    lines.append("=" * 80)
    lines.append(f"音频文件: {os.path.basename(audio_file)}")
    lines.append(f"转录时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"识别引擎: 讯飞LFasr (音频文件转写)")
    lines.append("=" * 80)
    lines.append("")
    
    # 提取文本
    lattice = order_data.get('lattice', [])
    
    for item in lattice:
        json_1best = item.get('json_1best', {})
        # 如果 json_1best 是字符串，需要再次解析
        if isinstance(json_1best, str):
            json_1best = json.loads(json_1best)
        st = json_1best.get('st', {})
        
        # 获取说话人和文本
        role = st.get('rl', 'unknown')
        segments = st.get('rt', [])
        
        # ⭐ 关键：bg和ed在st层级，不在segment中
        bg = st.get('bg', 0)
        ed = st.get('ed', 0)
        # 转换为数字（可能是字符串）
        if isinstance(bg, str):
            bg = int(bg) if bg.isdigit() else 0
        if isinstance(ed, str):
            ed = int(ed) if ed.isdigit() else 0
        # 转换为秒
        bg_seconds = bg / 1000.0
        ed_seconds = ed / 1000.0
        
        for segment in segments:
            words = segment.get('ws', [])
            text = ''.join([w.get('cw', [{}])[0].get('w', '') for w in words])
            
            if text.strip():
                # 格式化时间
                start_str = f"{int(bg_seconds // 60):02d}:{int(bg_seconds % 60):02d}"
                end_str = f"{int(ed_seconds // 60):02d}:{int(ed_seconds % 60):02d}"
                
                lines.append(f"[{start_str}-{end_str}] SPEAKER_{role}: {text.strip()}")
    
    # 写入文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    return output_file

if __name__ == '__main__':
    print("=" * 80)
    print("讯飞音频转录工具")
    print("=" * 80)
    print()
    
    # 支持从命令行参数传入音频文件路径
    if len(sys.argv) > 1 and sys.argv[1].strip():
        audio_file = sys.argv[1].strip()
    else:
        audio_file = r"E:\已转录\20250515-刘佳-阜新银行-阜新银行一表通建设\20250515-刘佳-阜新银行-阜新银行一表通建设.m4a"
    
    if not os.path.exists(audio_file):
        print(f"❌ 文件不存在: {audio_file}")
        input("\n按任意键退出...")
        sys.exit(1)
    
    print(f"准备转录: {audio_file}")
    print()
    
    result = transcribe_audio(audio_file)
    
    if result:
        print()
        print("=" * 80)
        print("✅ 转录成功！")
        print("=" * 80)
    else:
        print()
        print("=" * 80)
        print("❌ 转录失败")
        print("=" * 80)
    
    input("\n按任意键退出...")

