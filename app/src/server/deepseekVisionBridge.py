"""DeepSeek Harness 文本分析桥接：stdin JSON → harness agent → stdout JSON。

输入（stdin，JSON）：
  {
    "content": [ {"type": "text", "text": "..."} ],
    "model": "deepseek-v4-flash",   # 可选，默认取环境变量 DEEPSEEK_MODEL
    "max_tokens": 8000              # 可选
  }

输出（stdout，单行 JSON）：
  成功 {"ok": true, "text": "...", "finish_reason": "...", "model": "..."}
  失败 {"ok": false, "error": "..."}

说明：DeepSeek 官方 API 目前仅支持文本输入（chat-completions 对 image_url 内容块
返回 400，官方社区 discussion #1487 确认无时间表），因此图片由豆包 Ark 视觉模型
先行识别成文字描述，再经本桥接交给 DeepSeek 做综合分析；本桥接只走纯文本链路。

环境变量：DEEPSEEK_API_KEY（必需）、DEEPSEEK_BASE_URL / DEEPSEEK_MODEL（可选）。
"""
import json
import os
import shutil
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
# 源码构建的 runtime 入口（pnpm deploy 生成的 hoisted closure）
SOURCE_RUNTIME_BIN = os.path.join(
    REPO_ROOT, ".runtime-vision", "node_modules", "@deepseek-ai", "dsh-sdk-jsonrpc-demo", "lib", "packaged-bin.js"
)
CORDIS_VISION_YML = os.path.join(HERE, "cordis-vision.yml")


def main() -> None:
    payload = json.load(sys.stdin)
    content = payload.get("content") or []
    if not content:
        raise ValueError("content 为空，无法分析")

    blocks = []
    for item in content:
        if item.get("type") == "image_url":
            raise ValueError("DeepSeek 官方 API 不支持图像输入，图片需先由视觉模型转成文字描述")
        text = str(item.get("text") or "").strip()
        if text:
            blocks.append({"type": "text", "text": text})
    if not blocks:
        raise ValueError("content 中没有可用文本")

    model = (payload.get("model") or os.environ.get("DEEPSEEK_MODEL", "")).strip() or "deepseek-v4-flash"
    max_tokens = payload.get("max_tokens")

    from deepseek_harness import DeepSeekHarness

    kwargs = {"model": model}
    if max_tokens:
        kwargs["max_tokens"] = int(max_tokens)
    node_bin = shutil.which("node")
    if node_bin and os.path.exists(SOURCE_RUNTIME_BIN) and os.path.exists(CORDIS_VISION_YML):
        kwargs["launch_args_override"] = (node_bin, SOURCE_RUNTIME_BIN)
        kwargs["cordis"] = CORDIS_VISION_YML
        kwargs["session_root"] = os.path.join(tempfile.gettempdir(), "dsv-sessions")

    trace = os.environ.get("DSV_TRACE") == "1"
    started = time.time()

    def on_notification(notification) -> None:
        if not trace:
            return
        payload_n = notification.payload or {}
        event = payload_n.get("event") if isinstance(payload_n, dict) else None
        etype = event.get("type") if isinstance(event, dict) else None
        if etype == "assistant/message":
            data = event.get("data") or {}
            message = data.get("message") if isinstance(data, dict) else None
            content_n = (message or data).get("content") if isinstance(data, dict) else None
            kinds = [b.get("type") for b in content_n if isinstance(b, dict)] if isinstance(content_n, list) else []
            sys.stderr.write(f"[trace {time.time()-started:6.1f}s] assistant/message content_types={kinds}\n")
        elif etype in ("turn/end", "tool/use", "tool/result"):
            sys.stderr.write(f"[trace {time.time()-started:6.1f}s] {etype}\n")
            if etype == "turn/end":
                detail = json.dumps(event, ensure_ascii=False)
                sys.stderr.write(detail[:2000] + "\n")
        elif notification.method == "session.status":
            sys.stderr.write(f"[trace {time.time()-started:6.1f}s] session.status={payload_n.get('status')}\n")
        sys.stderr.flush()

    with DeepSeekHarness(**kwargs) as harness:
        result = harness.run(blocks, on_notification=on_notification)

    text = (result.final_response or "").strip()
    if not text:
        raise RuntimeError(f"harness 未返回分析文本（finish_reason={result.finish_reason}）")
    if result.finish_reason in ("max-tokens", "max_tokens", "length"):
        raise RuntimeError(f"harness 输出被截断（finish_reason={result.finish_reason}），请调大 max_tokens")

    print(json.dumps({
        "ok": True,
        "text": text,
        "finish_reason": result.finish_reason,
        "model": model,
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - 统一以 JSON 形式回报错误
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
