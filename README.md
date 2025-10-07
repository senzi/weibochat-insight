# weibochat-insight
A lightweight analytics dashboard for exploring large-scale Weibo group chat archives.

## 数据预处理

使用 `preprocess.py` 对原始 ndjson 数据进行预处理：

### 功能特点
- **进度条支持**：使用 tqdm 显示处理进度，包括文件级和行级进度条
- **智能过滤**：仅保留 type==321 且 sub_type != 101 的消息
- **内容分类**：自动标注 is_web / is_image / is_text
- **红包识别**：识别红包感谢类消息并抽取金额
- **Token 计算**：对文本消息计算 DeepSeek tokenizer token 数
- **输出优化**：移除了固定的 type 和 sub_type 字段，减少冗余数据

### 使用方法

```bash
# 安装依赖
pip3 install transformers tqdm

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

### 输出字段
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

### 进度条说明
- **文件级进度条**：显示整体文件处理进度
- **行级进度条**：显示单个文件内行的处理进度，包括处理速度和预计剩余时间

备注：DeepSeek的tokenizer要自己下载并解压
https://cdn.deepseek.com/api-docs/deepseek_v3_tokenizer.zip
