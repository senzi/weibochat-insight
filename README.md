# weibochat-insight
A lightweight analytics dashboard for exploring large-scale Weibo group chat archives.

## 项目概述

weibochat-insight 是一个轻量级的微博群聊数据分析工具，提供数据预处理和可视化分析功能。项目包含两个主要组件：

1. **数据预处理工具** (`preprocess.py`) - 对原始 ndjson 数据进行清洗和特征提取
2. **Web 分析仪表板** (`app.py`) - 提供交互式的数据可视化分析界面

## 功能特性

### 数据预处理
- **进度条支持**：使用 tqdm 显示处理进度，包括文件级和行级进度条
- **智能过滤**：仅保留 type==321 且 sub_type != 101 的消息
- **内容分类**：自动标注 is_web / is_image / is_text
- **红包识别**：识别红包感谢类消息并抽取金额
- **Token 计算**：对文本消息计算 DeepSeek tokenizer token 数
- **输出优化**：移除了固定的 type 和 sub_type 字段，减少冗余数据

### Web 仪表板
- **文件选择**：支持选择多个数据文件进行分析
- **实时统计**：显示总消息数、用户数、红包总额等关键指标
- **趋势分析**：每日消息量趋势、用户活跃度热力图
- **用户分析**：发言最多的用户排行、个人用户趋势
- **消息类型**：文本、图片、红包消息占比分析
- **内容分析**：消息长度分布、Token 数量分布
- **红包分析**：每日红包统计、用户红包收入排行
- **来源分析**：Web 端与移动端使用比例
- **数据导出**：支持下载仪表板快照

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 数据预处理

首先需要对原始 ndjson 数据进行预处理：

```bash
# 下载 DeepSeek tokenizer
# 从 https://cdn.deepseek.com/api-docs/deepseek_v3_tokenizer.zip 下载并解压到 ./deepseek_v3_tokenizer

# 预处理单个文件
python3 preprocess.py data/all.ndjson

# 预处理多个文件
python3 preprocess.py data/all.ndjson data/tk_all.ndjson

# 指定输出目录
python3 preprocess.py --out-dir data/processed data/all.ndjson

# 指定 tokenizer 目录
python3 preprocess.py --tokenizer-dir ./deepseek_v3_tokenizer data/all.ndjson
```

### 3. 启动 Web 仪表板

```bash
# 启动 Flask 服务器
python3 app.py

# 或使用指定端口
python3 app.py --port 8080
```

服务器启动后，访问 `http://localhost:2233` 即可查看仪表板。

## 数据格式

### 输入数据
原始数据应为 ndjson 格式，每行包含一条微博群聊消息记录。

### 预处理输出字段
预处理后的 ndjson 包含以下字段：
- `id`: 消息ID
- `time`: 时间戳
- `from_uid`: 发送者UID
- `screen_name`: 发送者昵称
- `is_web`: 是否来自网页版
- `is_image`: 是否为图片消息
- `is_text`: 是否为文本消息
- `is_redpacket`: 是否为红包感谢消息
- `redpacket_amount`: 红包金额（如果有）
- `content_len`: 内容长度
- `token_count`: token数量（文本消息）
- `media_type`: 媒体类型
- `appid`: 应用ID

## API 接口

Web 仪表板提供以下 REST API 接口：

- `GET /api/files` - 获取可用文件列表
- `POST /api/select_files` - 选择分析文件
- `GET /api/summary` - 获取总体统计
- `GET /api/daily` - 获取每日趋势数据
- `GET /api/hourly_heatmap` - 获取小时热力图数据
- `GET /api/top_users` - 获取活跃用户排行
- `GET /api/message_types` - 获取消息类型分布
- `GET /api/token_histogram` - 获取消息长度分布
- `GET /api/redpackets` - 获取红包统计数据
- `GET /api/user_redpacket_ranking` - 获取用户红包收入排行
- `GET /api/source_ratio` - 获取 Web vs Mobile 使用比例
- `GET /api/user_trend/<user_id>` - 获取指定用户的发送趋势

## 项目结构

```
weibochat-insight/
├── app.py                    # Flask Web 应用主文件
├── preprocess.py             # 数据预处理脚本
├── requirements.txt          # Python 依赖
├── README.md                 # 项目文档
├── data/                     # 数据目录
│   ├── processed/           # 预处理后的数据
│   └── .gitkeep
├── static/                   # 静态资源
│   ├── css/
│   │   └── style.css        # 样式文件
│   └── js/
│       └── dashboard.js     # 前端 JavaScript
├── templates/
│   └── index.html           # 仪表板页面模板
├── cache/                   # 缓存目录（自动生成）
└── doc/
    └── PRD.md               # 产品需求文档
```

## 技术栈

- **后端**: Flask, Pandas, NumPy
- **前端**: HTML, CSS, JavaScript, ECharts
- **数据处理**: Transformers (DeepSeek Tokenizer), tqdm
- **缓存**: Pickle (本地文件缓存)

## 注意事项

- DeepSeek 的 tokenizer 需要手动下载并解压到项目目录
- 红包金额大于 50 元的会被过滤，避免异常数据影响统计
- 预处理后的数据会缓存，重复分析相同文件时速度更快
- 支持同时分析多个数据文件

## 进度条说明

- **文件级进度条**：显示整体文件处理进度
- **行级进度条**：显示单个文件内行的处理进度，包括处理速度和预计剩余时间

## 下载 DeepSeek Tokenizer

DeepSeek 的 tokenizer 下载地址：
https://cdn.deepseek.com/api-docs/deepseek_v3_tokenizer.zip

下载后解压到项目根目录下的 `deepseek_v3_tokenizer` 文件夹中。
