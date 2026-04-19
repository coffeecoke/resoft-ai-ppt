# 智能信息爬取模块（采招网）

本模块源自项目 `E:\caizhaowang`，已接入 ai_backend，作为「智能信息爬取」功能使用。

## 功能

- 登录中国采招网，按关键词进行**标题搜索**
- 支持多关键词、分页、日期范围筛选
- 逐条打开详情页，提取正文（含表格转 Markdown）
- 支持详情页内 PDF / Aspose 查看器：下载 PDF 解析或 OCR 识别
- 结果保存为 txt/html 到 `ai_backend/scraper_output/关键词/` 目录
- 可选企业微信推送（在 `config.ini` 的 `[wecom]` 中配置）

## 依赖

```bash
pip install playwright pdfplumber
playwright install chromium
```

可选（详情页为扫描版 PDF 时用于 OCR）：

```bash
pip install rapidocr-onnxruntime
```

## 配置

编辑同目录下的 `config.ini`：

- `[scraper]`：必填 `username`、`password`（采招网账号）；`keywords`、`max_pages`、`output_format`、`start_date`、`end_date` 等。
- 通过 **Web 端或 API 执行爬取**时，可传入本次的 `keywords`、`max_pages`、`start_date`、`end_date`，无需改配置文件；输出目录由 ai_backend 通过环境变量指定为 `ai_backend/scraper_output`。

## 在 ai_backend 中的使用

1. **Web 界面**：打开 AI 管理后台 → 侧栏「智能信息爬取」→ 填写关键词与参数 → 点击「开始爬取」。
2. **API**：
   - `GET /api/scraper/config`：获取配置（不含密码）
   - `PUT /api/scraper/config`：更新可编辑配置项
   - `POST /api/scraper/run`：执行爬取（body 可传 `keywords`、`max_pages`、`start_date`、`end_date`）
   - `GET /api/scraper/results`：按关键词列出结果文件
   - `GET /api/scraper/results/preview?path=scraper_output/关键词/文件名.txt`：预览文件内容

## 环境变量（由 Node 调用时设置）

- `SCRAPER_OUTPUT_DIR`：输出根目录（默认由 ai_backend 设为 `scraper_output` 的绝对路径）
- `SCRAPER_MAX_PAGES`：每词最多页数
- `SCRAPER_START_DATE` / `SCRAPER_END_DATE`：日期范围，格式 `YYYY-MM-DD`

命令行传入的关键词会覆盖 `config.ini` 中的 `keywords`，例如：

```bash
python scraper.py 招标公告 中标公示
```

## 兼容原项目 E:\caizhaowang

- 将 `E:\caizhaowang` 下的 `scraper.py`、`wecom_notify.py`、`config.ini` 复制到本目录即可在本地单独运行（需自行指定输出目录或使用默认 `output`）。
- 本目录下的 `scraper.py` 已增加环境变量覆盖逻辑，便于 ai_backend 调用时传入输出目录与参数。
