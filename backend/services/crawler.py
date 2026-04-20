import logging
import feedparser
import httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

RSS_FEEDS = [
    {"name": "OpenAI Blog", "url": "https://openai.com/news/rss.xml"},
    {"name": "Anthropic", "url": "https://www.anthropic.com/rss.xml"},
    {"name": "Google DeepMind", "url": "https://deepmind.google/blog/rss.xml"},
    {"name": "HuggingFace", "url": "https://huggingface.co/blog/feed.xml"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
    {"name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/feed/"},
]

HN_TOPSTORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item/{id}.json"

# 最近 N 小时内的内容才算"新鲜"
FRESHNESS_HOURS = 24


def _parse_entry_time(entry) -> datetime:
    """安全解析 feedparser entry 的发布时间"""
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).replace(tzinfo=None)
    except Exception:
        pass
    return datetime.utcnow()


def fetch_rss_items(max_per_feed: int = 10) -> list[dict]:
    """抓取所有 RSS 源的最新条目"""
    items = []
    for feed_conf in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_conf["url"])
            for entry in feed.entries[:max_per_feed]:
                title = entry.get("title", "").strip()
                link = entry.get("link", "")
                summary = entry.get("summary", entry.get("description", "")).strip()
                # 去除 HTML 标签（简单处理）
                import re
                summary = re.sub(r"<[^>]+>", " ", summary)[:500]
                if title and link:
                    items.append({
                        "title": title,
                        "url": link,
                        "summary": summary,
                        "source_name": feed_conf["name"],
                        "published_at": _parse_entry_time(entry),
                    })
        except Exception as e:
            logger.warning(f"RSS 抓取失败 [{feed_conf['name']}]: {e}")
    logger.info(f"RSS 抓取完毕，共 {len(items)} 条")
    return items


def fetch_hn_items(limit: int = 30, min_score: int = 50) -> list[dict]:
    """抓取 Hacker News Top Stories（过滤低分）"""
    items = []
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(HN_TOPSTORIES_URL)
            resp.raise_for_status()
            story_ids = resp.json()[:limit * 2]  # 多拉一些，过滤后够用

        count = 0
        with httpx.Client(timeout=10) as client:
            for sid in story_ids:
                if count >= limit:
                    break
                try:
                    r = client.get(HN_ITEM_URL.format(id=sid))
                    r.raise_for_status()
                    item = r.json()
                    if (
                        item
                        and item.get("type") == "story"
                        and item.get("score", 0) >= min_score
                        and item.get("url")
                        and item.get("title")
                    ):
                        items.append({
                            "title": item["title"],
                            "url": item["url"],
                            "summary": f"HN score: {item.get('score', 0)}, comments: {item.get('descendants', 0)}",
                            "source_name": "Hacker News",
                            "published_at": datetime.utcfromtimestamp(item.get("time", 0)),
                        })
                        count += 1
                except Exception:
                    continue
    except Exception as e:
        logger.warning(f"HN 抓取失败: {e}")
    logger.info(f"HN 抓取完毕，共 {len(items)} 条")
    return items


def search_keyword(keyword: str, max_results: int = 10) -> list[dict]:
    """使用 DuckDuckGo 搜索关键词相关最新内容"""
    items = []
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.news(keyword, max_results=max_results, timelimit="d"))
        for r in results:
            title = r.get("title", "").strip()
            url = r.get("url", "")
            body = r.get("body", "").strip()[:500]
            source = r.get("source", "DuckDuckGo")
            if title and url:
                items.append({
                    "title": title,
                    "url": url,
                    "summary": body,
                    "source_name": source,
                    "published_at": datetime.utcnow(),
                })
    except Exception as e:
        logger.warning(f"DuckDuckGo 搜索失败 [{keyword}]: {e}")
    logger.info(f"DDG 搜索 '{keyword}'，共 {len(items)} 条")
    return items
