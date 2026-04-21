import json
import logging
import requests
from backend.config import get_settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def _call_openrouter(messages: list[dict], max_tokens: int = 512) -> str | None:
    """调用 OpenRouter API，返回 content 文本，失败返回 None"""
    settings = get_settings()
    api_key = settings.OPENROUTER_API_KEY

    if not api_key or api_key == "your_openrouter_api_key_here":
        logger.warning("OpenRouter API Key 未配置，跳过 AI 分析")
        return None

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/hot-monitor",
        "X-OpenRouter-Title": "hot-monitor",
    }
    body = {
        "model": settings.AI_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }

    try:
        resp = requests.post(OPENROUTER_URL, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except requests.RequestException as e:
        logger.error(f"OpenRouter 请求失败: {e}")
        return None
    except (KeyError, IndexError) as e:
        logger.error(f"OpenRouter 响应解析失败: {e}")
        return None


def analyze_topic(title: str, content: str) -> dict:
    """
    分析一条内容的热点属性。
    返回字典：is_genuine, heat_score, summary, tags
    失败时返回默认值（不阻塞流程）
    """
    default = {
        "is_genuine": True,
        "heat_score": 5,
        "summary": title[:100],
        "tags": [],
    }

    system_prompt = (
        "你是一位专业的科技媒体编辑，擅长识别 AI / 科技领域的真实热点。\n"
        "重点关注：最新发布、重大突破、产品更新、融资事件、政策变化等时效性强的内容。\n"
        "过滤掉：过时的旧闻、常识科普、软文广告、标题党、学术综述类内容。\n"
        "heat_score 评分标准：8-10=重大突破/行业震动，6-7=值得关注的新动态，4-5=一般资讯，1-3=旧闻/低价值。\n"
        "返回严格的 JSON 格式（不要有额外文字）：\n"
        '{"is_genuine": true/false, "heat_score": 1-10, '
        '"summary": "中文摘要不超过100字", "tags": ["标签1","标签2"]}'
    )
    user_msg = f"标题：{title}\n\n内容：{content[:800]}"

    raw = _call_openrouter(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ]
    )
    if not raw:
        return default

    try:
        result = json.loads(raw)
        return {
            "is_genuine": bool(result.get("is_genuine", True)),
            "heat_score": max(1, min(10, int(result.get("heat_score", 5)))),
            "summary": str(result.get("summary", title))[:200],
            "tags": [str(t) for t in result.get("tags", [])[:4]],
        }
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"AI 响应 JSON 解析失败: {e}，原始: {raw[:200]}")
        return default


def check_keyword_relevance(keyword: str, title: str, content: str) -> dict:
    """
    判断内容是否与关键词真实相关。
    返回：{"is_relevant": bool, "relevance_score": int, "reason": str}
    """
    default = {"is_relevant": True, "relevance_score": 5, "reason": "AI 未返回相关性理由"}

    system_prompt = (
        f'判断以下内容是否与关键词 "{keyword}" 真实相关（非关键词堆砌、非标题党、非广告）。\n'
        "返回严格的 JSON（不要有额外文字）：\n"
        '{"is_relevant": true/false, "relevance_score": 0-10, "reason": "一句话说明"}'
    )
    user_msg = f"标题：{title}\n内容：{content[:500]}"

    raw = _call_openrouter(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=200,
    )
    if not raw:
        return default

    try:
        result = json.loads(raw)
        return {
            "is_relevant": bool(result.get("is_relevant", True)),
            "relevance_score": max(0, min(10, int(result.get("relevance_score", 5)))),
            "reason": str(result.get("reason", "AI 未提供理由"))[:300],
        }
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"关键词相关性 JSON 解析失败: {e}")
        return default
