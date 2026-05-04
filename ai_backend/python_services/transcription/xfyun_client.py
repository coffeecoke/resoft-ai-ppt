"""
讯飞音频转录客户端
封装讯飞 API 调用逻辑
"""
import json
import logging
import os
import sys
import time
from pathlib import Path

# 添加SDK路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# ⭐ 修复大文件上传超时问题：设置 httpx 默认超时时间
# 讯飞SDK内部使用 httpx，需要增加超时时间以支持大文件上传
def _configure_httpx_timeout():
    """配置 httpx 的超时时间，解决大文件上传超时问题"""
    try:
        import httpx
        
        # 方法1：通过 monkey patch 修改 httpx.Client 和 httpx.AsyncClient 的默认超时
        # 保存原始的 Client 和 AsyncClient
        _original_client_init = httpx.Client.__init__
        _original_async_client_init = None
        if hasattr(httpx, 'AsyncClient'):
            _original_async_client_init = httpx.AsyncClient.__init__
        
        def _patched_client_init(self, *args, **kwargs):
            # 如果没有指定 timeout，使用默认的大超时时间
            if 'timeout' not in kwargs:
                kwargs['timeout'] = httpx.Timeout(
                    connect=30.0,      # 连接超时：30秒
                    read=1800.0,       # 读取超时：30分钟
                    write=1800.0,      # 写入超时：30分钟（关键：解决 write operation timed out）
                    pool=30.0          # 连接池超时：30秒
                )
            return _original_client_init(self, *args, **kwargs)
        
        def _patched_async_client_init(self, *args, **kwargs):
            if 'timeout' not in kwargs:
                kwargs['timeout'] = httpx.Timeout(
                    connect=30.0,
                    read=1800.0,
                    write=1800.0,
                    pool=30.0
                )
            return _original_async_client_init(self, *args, **kwargs)
        
        # 应用 monkey patch
        httpx.Client.__init__ = _patched_client_init
        if _original_async_client_init:
            httpx.AsyncClient.__init__ = _patched_async_client_init
        
        # 方法2：通过环境变量设置（如果SDK支持）
        os.environ.setdefault('HTTPX_DEFAULT_TIMEOUT', '1800')  # 30分钟
        os.environ.setdefault('HTTPX_WRITE_TIMEOUT', '1800')     # 写入超时30分钟
        
        return True
    except Exception as e:
        # 如果设置失败，记录警告但不影响运行
        logging.warning(f"⚠️ 无法设置 httpx 超时配置: {e}")
        return False

# 在模块加载时配置超时
_configure_httpx_timeout()

# ⭐ 关键修复：Monkey patch 讯飞SDK的HttpClient类，将数字timeout转换为httpx.Timeout对象
def _patch_xfyun_http_client():
    """修复讯飞SDK的HttpClient，支持大文件上传的超时配置"""
    try:
        from xfyunsdkcore import http_client
        import httpx
        
        # 保存原始方法
        _original_http_client_init = http_client.HttpClient.__init__
        _original_sync_request = http_client.HttpClient._sync_request
        
        def _patched_http_client_init(self, *args, **kwargs):
            # 调用原始初始化
            _original_http_client_init(self, *args, **kwargs)
            
            # 如果timeout是数字，转换为httpx.Timeout对象
            # 默认使用大超时时间以支持大文件上传
            if isinstance(self.timeout, (int, float)):
                # 如果是默认的30秒或小于等于60秒，使用大超时时间（30分钟）
                if self.timeout <= 60:
                    self.timeout = httpx.Timeout(
                        connect=30.0,      # 连接超时：30秒
                        read=1800.0,       # 读取超时：30分钟
                        write=1800.0,       # 写入超时：30分钟（关键！）
                        pool=30.0          # 连接池超时：30秒
                    )
                else:
                    # 如果已经设置了较大的超时，转换为httpx.Timeout对象
                    timeout_seconds = float(self.timeout)
                    self.timeout = httpx.Timeout(
                        connect=30.0,
                        read=timeout_seconds,
                        write=timeout_seconds,  # 关键：写入超时
                        pool=30.0
                    )
            # 如果已经是httpx.Timeout对象，保持不变
        
        def _patched_sync_request(self, method, url, **kwargs):
            """修复_sync_request方法，确保使用httpx.Timeout对象"""
            # 确保timeout是httpx.Timeout对象
            if isinstance(self.timeout, (int, float)):
                if self.timeout <= 60:
                    self.timeout = httpx.Timeout(
                        connect=30.0,
                        read=1800.0,
                        write=1800.0,
                        pool=30.0
                    )
                else:
                    timeout_seconds = float(self.timeout)
                    self.timeout = httpx.Timeout(
                        connect=30.0,
                        read=timeout_seconds,
                        write=timeout_seconds,
                        pool=30.0
                    )
            # 调用原始方法（它会使用self.timeout，现在已经是httpx.Timeout对象）
            return _original_sync_request(self, method, url, **kwargs)
        
        # 应用monkey patch
        http_client.HttpClient.__init__ = _patched_http_client_init
        http_client.HttpClient._sync_request = _patched_sync_request
        
        logger_temp = logging.getLogger(__name__)
        logger_temp.info("✅ 已修复讯飞SDK HttpClient的超时配置")
        return True
    except Exception as e:
        logging.warning(f"⚠️ 无法修复讯飞SDK HttpClient: {e}")
        import traceback
        traceback.print_exc()
        return False

# 先导入SDK模块
from xfyunsdkspeech.lfasr_client import LFasrClient
from xfyunsdkcore.model.lfasr_model import UploadParam

# 然后应用patch（必须在导入后）
_patch_xfyun_http_client()

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 讯飞 getResult 限频：100012 = access too fast（需等待后重试，勿直接退出）
XFYUN_ERR_QUERY_TOO_FAST = "100012"
# 官方建议回调拉结果；轮询间隔不宜过短（秒）
POLL_INTERVAL_SEC = 8
UPLOAD_TO_FIRST_QUERY_DELAY_SEC = 3
UPLOAD_RETRY_INTERVAL_SEC = 60
UPLOAD_MAX_RETRIES = 3


def _read_env_int(name, default_value, min_value=None, max_value=None):
    """读取整数环境变量，非法时回退默认值。"""
    raw = os.environ.get(name)
    if raw is None or str(raw).strip() == "":
        return default_value
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return default_value
    if min_value is not None and value < min_value:
        return default_value
    if max_value is not None and value > max_value:
        return max_value
    return value

# 讯飞API凭证
APP_ID = "30fb0f0d"
API_KEY = "8a96101efefbab3880e7e491b78139de"
API_SECRET = "704fdea92fb9c8cec33d9f5705a06b69"


def _ai_backend_root():
    """本文件位于 python_services/transcription/，向上三级为 ai_backend。"""
    return Path(__file__).resolve().parent.parent.parent


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
    
    # ⭐ 根据文件大小动态调整超时时间
    file_size_mb = os.path.getsize(audio_file) / (1024 * 1024)
    
    import httpx
    
    # 超时参数（支持环境变量覆盖）
    # 大文件上传默认策略：最少30分钟，最多120分钟；可通过环境变量调整
    min_timeout_minutes = _read_env_int("XFYUN_UPLOAD_TIMEOUT_MIN_MINUTES", 30, min_value=1, max_value=24 * 60)
    max_timeout_minutes = _read_env_int("XFYUN_UPLOAD_TIMEOUT_MAX_MINUTES", 120, min_value=1, max_value=24 * 60)
    if min_timeout_minutes > max_timeout_minutes:
        min_timeout_minutes = max_timeout_minutes

    small_file_timeout_seconds = _read_env_int(
        "XFYUN_SMALL_FILE_TIMEOUT_SECONDS",
        max(min_timeout_minutes * 60, 1800),
        min_value=60,
        max_value=24 * 60 * 60
    )

    # 对于大文件（>100MB），需要更长的超时时间
    if file_size_mb > 100:
        # 计算超时时间：每MB需要约5秒，最小/最大由环境变量控制
        timeout_minutes = max(min_timeout_minutes, min(max_timeout_minutes, int(file_size_mb * 5 / 60)))
        timeout_seconds = timeout_minutes * 60
        
        logger.info(f"📦 检测到大文件 ({file_size_mb:.1f} MB)，设置超时时间为 {timeout_minutes} 分钟")
        
        # 为大文件创建httpx.Timeout对象
        custom_timeout = httpx.Timeout(
            connect=30.0,
            read=timeout_seconds,
            write=timeout_seconds,  # 关键：写入超时
            pool=30.0
        )
        timeout_param = timeout_seconds  # 传入秒数，monkey patch会转换为httpx.Timeout
    else:
        # 小文件使用默认超时（可配置，默认不低于30分钟）
        timeout_seconds = small_file_timeout_seconds
        custom_timeout = httpx.Timeout(
            connect=30.0,
            read=float(timeout_seconds),
            write=float(timeout_seconds),
            pool=30.0
        )
        timeout_param = timeout_seconds
    
    # ⭐ 初始化客户端，传入超时参数
    # monkey patch会将数字timeout转换为httpx.Timeout对象
    client = LFasrClient(
        app_id=APP_ID,
        secret_key=API_SECRET,  # 使用 APISecret 作为 secret_key（不是 APIKey）
        timeout=timeout_param,  # 传入秒数，monkey patch会转换为httpx.Timeout
    )
    
    # ⭐ 直接修改客户端的timeout属性为httpx.Timeout对象（确保生效）
    # 这样可以绕过SDK可能的问题，直接设置正确的超时对象
    client.timeout = custom_timeout

    try:
        # 1. 上传文件
        logger.info("=" * 80)
        logger.info("开始上传音频文件...")
        logger.info("=" * 80)
        
        logger.info(f"文件: {os.path.basename(audio_file)}")
        logger.info(f"大小: {file_size_mb:.1f} MB")
        
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
        
        # ⭐ 上传文件（大文件可能需要较长时间）
        logger.info("📤 开始上传文件到讯飞服务器...")
        logger.info("💡 提示：大文件上传可能需要几分钟，请耐心等待...")
        
        upload_data = None
        for attempt in range(1, UPLOAD_MAX_RETRIES + 2):
            try:
                upload_resp = client.upload(param_dict, audio_file)
                upload_data = json.loads(upload_resp)
                break
            except Exception as upload_error:
                error_msg = str(upload_error)
                logger.error(f"❌ 上传过程中发生错误（第 {attempt} 次）: {error_msg}")
                
                # 检查是否是超时错误
                if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                    logger.error("⏱️  上传超时！可能的原因：")
                    logger.error("   1. 文件太大，网络上传速度较慢")
                    logger.error("   2. 网络连接不稳定")
                    logger.error("   3. 讯飞服务器响应较慢")
                    logger.error(f"💡 建议：文件大小 {file_size_mb:.1f} MB，请检查网络连接或稍后重试")
                
                if attempt <= UPLOAD_MAX_RETRIES:
                    logger.warning(
                        f"⚠️ 上传失败，{UPLOAD_RETRY_INTERVAL_SEC} 秒后重试（第 {attempt}/{UPLOAD_MAX_RETRIES} 次重试）"
                    )
                    time.sleep(UPLOAD_RETRY_INTERVAL_SEC)
                    continue
                
                raise  # 超过重试次数，交给外层统一处理
        
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
        
        # 上传后立即查结果容易触发 100012，先短暂等待
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
                    # 指数退避，上限 60s，避免持续打满限频
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
                
                # 注意：不在这里打开记事本，避免阻塞进程
                # 如果需要查看，可以手动打开 output_file
                
                return output_file
                
            elif status == -1:
                failType = result_data['content']['orderInfo']['failType']
                logger.error(f"❌ 转录失败: {orderId}, 失败类型: {failType}")
                break
                
            time.sleep(POLL_INTERVAL_SEC)
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ 发生错误: {error_msg}")
        
        # 特殊处理超时错误
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            logger.error("=" * 80)
            logger.error("⏱️  上传超时错误处理建议：")
            logger.error("   1. 检查网络连接是否稳定")
            logger.error("   2. 如果文件很大（>300MB），可能需要更长时间")
            logger.error("   3. 可以尝试在网络较好的时段重试")
            logger.error("   4. 或者考虑压缩音频文件后重试")
            logger.error("=" * 80)
        
        import traceback
        logger.error("详细错误堆栈：")
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

