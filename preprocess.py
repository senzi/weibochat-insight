#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
preprocess.py
- 读取 data/all.ndjson 与 data/tk_all.ndjson（或你传入的任意 ndjson）
- 仅保留 type==321 且 sub_type != 101 的消息
- 标注 is_web / is_image / is_text
- 识别红包感谢类消息并抽取金额
- 对 is_text 的消息计算 token 数（DeepSeek tokenizer）
- 不修改原始 ndjson，输出到 data/processed/<basename>.ndjson
用法：
  pip3 install transformers
  python3 preprocess.py --tokenizer-dir ./deepseek_v3_tokenizer \
                        data/all.ndjson data/tk_all.ndjson
"""

import argparse, json, os, re, sys
from pathlib import Path
from typing import Tuple, Optional
from tqdm import tqdm

# =============== 红包感谢检测 ===============
_redpacket_pat = re.compile(
    r'(?P<amount>\d+(?:\.\d+)?)\s*元\s*[,， ]*\s*@',
    flags=re.IGNORECASE
)

def detect_redpacket_thanks(text: str) -> Tuple[bool, Optional[float]]:
    """
    检测是否为红包感谢类消息，并提取金额
    规则：形如“0.52元，@某人”“2元,@xxx”“1.00 元 ，@xxx”
    """
    if not text:
        return False, None
    m = _redpacket_pat.search(text)
    if m:
        try:
            return True, float(m.group('amount'))
        except Exception:
            return True, None
    return False, None

# =============== Tokenizer 载入 ===============
def load_tokenizer(tok_dir: Path):
    try:
        import transformers
    except ImportError:
        print("请先安装 transformers： pip3 install transformers", file=sys.stderr)
        sys.exit(1)
    # 允许本地目录；DeepSeek 的 tokenizer 一般含 tokenizer.json / vocab files
    tok = transformers.AutoTokenizer.from_pretrained(
        str(tok_dir),
        trust_remote_code=True
    )
    return tok

def count_tokens(tokenizer, text: str) -> int:
    if not text:
        return 0
    # 计数口径：包含特殊符号与否差别很小，这里取不含特殊符号更贴近“纯文本长度”
    # 如需含特殊符号，改为 add_special_tokens=True
    return len(tokenizer.encode(text, add_special_tokens=False))

# =============== 主处理 ===============
def process_file(in_path: Path, out_dir: Path, tokenizer):
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{in_path.stem}.ndjson"

    # 首先计算总行数用于进度条
    total_lines = 0
    with in_path.open("r", encoding="utf-8") as f:
        for _ in f:
            total_lines += 1

    kept, total = 0, 0
    with in_path.open("r", encoding="utf-8") as fin, \
         out_path.open("w", encoding="utf-8") as fout:
        
        # 使用tqdm创建进度条
        for line in tqdm(fin, total=total_lines, desc=f"处理 {in_path.name}", 
                         unit="行", ncols=100):
            total += 1
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except Exception:
                # 跳过坏行
                continue

            # 过滤条件：仅保留 type==321 且 sub_type!=101
            if msg.get("type") != 321:
                continue
            if msg.get("sub_type") == 101:
                continue

            annotations = msg.get("annotations", {}) or {}
            media_type = msg.get("media_type", None)

            is_web  = (annotations.get("send_from") == "webchat")
            is_img  = (media_type == 1)
            is_text = (media_type == 0)

            content = msg.get("content") or ""
            is_red, amount = detect_redpacket_thanks(content)

            # 文本 token 数（仅对 is_text 计数；图片的 content 是你后处理描述，不计）
            token_count = count_tokens(tokenizer, content) if is_text else 0

            row = {
                # 最重要的几列
                "id": msg.get("id"),
                "time": msg.get("time"),
                "from_uid": msg.get("from_uid"),
                "screen_name": (msg.get("from_user") or {}).get("screen_name"),

                # 判别标签
                "is_web": bool(is_web),
                "is_image": bool(is_img),
                "is_text": bool(is_text),

                # 红包感谢类
                "is_redpacket": bool(is_red),
                "redpacket_amount": amount,

                # 文本度量
                "content_len": len(content),
                "token_count": int(token_count),

                # 可选保留的原字段，便于后续用
                "media_type": media_type,
                "appid": msg.get("appid"),

                # 注意：不写回原始消息，不改原 ndjson
                # type和sub_type字段已移除，因为都是固定值（type=321, sub_type!=101）
            }

            fout.write(json.dumps(row, ensure_ascii=False) + "\n")
            kept += 1

    print(f"[OK] {in_path.name}: kept {kept}/{total} → {out_path}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", help="输入 ndjson 文件，如 data/all.ndjson data/tk_all.ndjson")
    parser.add_argument("--tokenizer-dir", default="./deepseek_v3_tokenizer",
                        help="DeepSeek tokenizer 目录（包含 tokenizer.json 等）")
    parser.add_argument("--out-dir", default="data/processed",
                        help="输出目录（默认 data/processed）")
    args = parser.parse_args()

    tok = load_tokenizer(Path(args.tokenizer_dir))
    out_dir = Path(args.out_dir)

    # 使用tqdm显示整体处理进度
    for p in tqdm(args.inputs, desc="处理文件", unit="文件", ncols=100):
        process_file(Path(p), out_dir, tok)

if __name__ == "__main__":
    main()
