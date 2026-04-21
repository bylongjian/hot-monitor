import re
import logging
import feedparser
import httpx
from datetime import datetime, timezone
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)

# ─── RSS 源列表 ─────────────────────────────────────────────────────────────────

RSS_FEEDS = [
    # 英文 AI 公司官方
    {"name": "OpenAI Blog", "url": "https://openai.com/news/rss.xml"},
    {"name": "Google DeepMind", "url": "https://deepmind.google/blog/rss.xml"},
    {"name": "HuggingFace", "url": "https://huggingface.co/blog/feed.xml"},
    # 英文科技媒体
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
    {"name": "VentureBeat AI", "url": "https://venturebeat.com/category/ai/feed/"},
    # Google News AI
    {"name": "Google News AI", "url": "https://news.google.com/rss/search?q=artificial+intelligence&hl=en-US&gl=US&ceid=US:en"},
    # 中文 AI 媒体
    {"name": "机器之心", "url": "https://www.jiqizhixin.com/rss"},
    {"name": "量子位", "url": "https://www.qbitai.com/feed"},
]

# Reddit AI 子版块（公开 JSON，无需 Key）
REDDIT_SUBS = [
    {"name": "r/MachineLearning", "url": "https://www.reddit.com/r/MachineLearning/hot.json?limit=20"},
    {"name": "r/artificial", "url": "https://www.reddit.com/r/artificial/hot.json?limit=20"},
    {"name": "r/LocalLLaMA", "url": "https://www.reddit.com/r/LocalLLaMA/hot.json?limit=20"},
]

HN_TOPSTORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json"
HN_ITEM_URL = "https://hacker-news.firebaseio.com/v0/item/{id}.json"

FRESHNESS_HOURS = 48  # 时效性过滤窗口（小时）

# ─── X/Twitter Nitter 公共实例 ──────────────────────────────────────────────────

NITTER_INSTANCES = [
    "xcancel.com",
    "nitter.privacydev.net",
    "nitter.poast.org",
    "nitter.1d4.us",
    "nitter.cz",
]

# AI 领域 X/Twitter 搜索关键词
X_AI_SEARCH_QUERIES = ["AI announcement", "LLM release", "ChatGPT", "OpenAI", "Claude AI"]

# AI 领域关键人物 X/Twitter 账号
X_AI_KEY_ACCOUNTS = [
    ("sama", "Sam Altman"),
    ("ylecun", "Yann LeCun"),
    ("karpathy", "Andrej Karpathy"),
    ("DrJimFan", "Jim Fan"),
    ("AndrewYNg", "Andrew Ng"),
    ("GoogleDeepMind", "Google DeepMind"),
    ("OpenAI", "OpenAI"),
    ("AnthropicAI", "Anthropic"),
]

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _strip_html(text: str) -> str:
    """去除 HTML 标签"""
    return re.sub(r"<[^>]+>", " ", text).strip()


def _parse_entry_time(entry) -> datetime:
    """安全解析 feedparser entry 的发布时间"""
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).replace(tzinfo=None)
    except Exception:
        pass
    return datetime.utcnow()


# ─── RSS ─────────────────────────────────────────────────────────────────────────

def fetch_rss_items(max_per_feed: int = 10) -> list[dict]:
    """抓取所有 RSS 源的最新条目"""
    items = []
    with httpx.Client(timeout=8, headers=_HEADERS, follow_redirects=True) as client:
        for feed_conf in RSS_FEEDS:
            try:
                resp = client.get(feed_conf["url"])
                resp.raise_for_status()
                feed = feedparser.parse(resp.content)
                for entry in feed.entries[:max_per_feed]:
                    title = entry.get("title", "").strip()
                    link = entry.get("link", "")
                    summary = entry.get("summary", entry.get("description", "")).strip()
                    summary = _strip_html(summary)[:500]
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


# ─── Reddit ──────────────────────────────────────────────────────────────────────

def fetch_reddit_items(min_score: int = 100, min_comments: int = 20) -> list[dict]:
    """抓取 Reddit AI 子版块热帖（公开 JSON API）"""
    items = []
    for sub in REDDIT_SUBS:
        try:
            with httpx.Client(timeout=15, headers=_HEADERS) as client:
                resp = client.get(sub["url"])
                resp.raise_for_status()
                data = resp.json()
            for post in data.get("data", {}).get("children", []):
                pd = post.get("data", {})
                score = pd.get("score", 0)
                num_comments = pd.get("num_comments", 0)
                title = pd.get("title", "").strip()
                url = pd.get("url", "")
                selftext = pd.get("selftext", "")[:500]
                # 硬过滤：分数 + 评论
                if score < min_score or num_comments < min_comments:
                    continue
                if not title or not url:
                    continue
                # 跳过 Reddit 内部链接（自帖）
                permalink = f"https://www.reddit.com{pd.get('permalink', '')}"
                if url.startswith("https://www.reddit.com/r/"):
                    url = permalink
                items.append({
                    "title": title,
                    "url": url,
                    "summary": f"⬆ {score} | 💬 {num_comments} — {selftext[:300]}".strip(),
                    "source_name": sub["name"],
                    "published_at": datetime.utcfromtimestamp(pd.get("created_utc", 0)),
                })
        except Exception as e:
            logger.warning(f"Reddit 抓取失败 [{sub['name']}]: {e}")
    logger.info(f"Reddit 抓取完毕，共 {len(items)} 条")
    return items


# ─── Hacker News ─────────────────────────────────────────────────────────────────

def fetch_hn_items(limit: int = 20, min_score: int = 200, min_comments: int = 30) -> list[dict]:
    """抓取 Hacker News Top Stories（高门槛过滤）"""
    items = []
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.get(HN_TOPSTORIES_URL)
            resp.raise_for_status()
            story_ids = resp.json()[:limit * 3]

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
                        and item.get("descendants", 0) >= min_comments
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


# ─── GitHub Trending ─────────────────────────────────────────────────────────────

def fetch_github_trending() -> list[dict]:
    """抓取 GitHub Trending 仓库（AI/ML 相关）"""
    items = []
    try:
        url = "https://github.com/trending?since=daily&spoken_language_code=&language="
        with httpx.Client(timeout=15, headers=_HEADERS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text

        # 简单正则解析 trending 项目
        pattern = r'<h2 class="h3 lh-condensed">.*?<a href="([^"]+)"[^>]*>\s*(.*?)\s*</a>'
        desc_pattern = r'<p class="col-9[^"]*">(.*?)</p>'
        star_pattern = r'(\d[\d,]*)\s*stars today'
        repos = re.findall(pattern, html, re.DOTALL)
        descs = re.findall(desc_pattern, html, re.DOTALL)
        stars = re.findall(star_pattern, html)

        for i, (path, name) in enumerate(repos[:15]):
            name = _strip_html(name).replace("\n", "").strip()
            name = re.sub(r"\s+", " ", name).replace(" / ", "/")
            desc = _strip_html(descs[i]).strip() if i < len(descs) else ""
            star_today = stars[i].replace(",", "") if i < len(stars) else "0"
            repo_url = f"https://github.com{path.strip()}"
            items.append({
                "title": f"🔥 {name} — ⭐ {star_today} stars today",
                "url": repo_url,
                "summary": desc[:500],
                "source_name": "GitHub Trending",
                "published_at": datetime.utcnow(),
            })
    except Exception as e:
        logger.warning(f"GitHub Trending 抓取失败: {e}")
    logger.info(f"GitHub Trending 抓取完毕，共 {len(items)} 条")
    return items


# ─── X/Twitter AI 热门话题 ──────────────────────────────────────────────────────

def fetch_x_ai_topics(max_per_query: int = 5, max_per_account: int = 3) -> list[dict]:
    """获取 X/Twitter AI 热门话题（通过 Nitter 公共实例）"""
    items: list[dict] = []
    seen_urls: set[str] = set()

    def _add(title: str, link: str, summary: str, source: str, pub_time):
        if not title or not link or link in seen_urls:
            return
        # Nitter 链接转 X 链接
        for inst in NITTER_INSTANCES:
            link = link.replace(f"https://{inst}", "https://x.com")
        seen_urls.add(link)
        items.append({
            "title": title[:200],
            "url": link,
            "summary": (summary or "")[:500],
            "source_name": source,
            "published_at": pub_time,
        })

    with httpx.Client(timeout=6, headers=_HEADERS, follow_redirects=True) as client:
        working = None
        # 找到可用的 Nitter 实例
        for inst in NITTER_INSTANCES:
            try:
                resp = client.get(f"https://{inst}/OpenAI/rss")
                if resp.status_code == 200 and (b"<item>" in resp.content or b"<entry>" in resp.content):
                    working = inst
                    feed = feedparser.parse(resp.content)
                    for entry in feed.entries[:max_per_account]:
                        title = _strip_html(entry.get("title", "")).strip()
                        link = entry.get("link", "")
                        summary = _strip_html(entry.get("description", entry.get("summary", "")))
                        _add(f"@OpenAI: {title[:150]}", link, summary, "X @OpenAI", _parse_entry_time(entry))
                    break
            except Exception:
                continue

        if not working:
            logger.warning("X/Twitter: 所有 Nitter 实例不可用，尝试 Google News 回退")
            # 回退：通过 Google News 搜索 Twitter/X 上的 AI 热门内容
            _x_google_news_fallback(items, seen_urls, client)
            logger.info(f"X/Twitter AI 话题抓取完毕（Google News 回退），共 {len(items)} 条")
            return items

        logger.info(f"X/Twitter: 使用 Nitter 实例 {working}")

        # 1. AI 关键词搜索（获取热门讨论）
        for query in X_AI_SEARCH_QUERIES:
            try:
                url = f"https://{working}/search/rss?q={quote_plus(query)}&f=tweets"
                resp = client.get(url)
                if resp.status_code != 200:
                    continue
                feed = feedparser.parse(resp.content)
                for entry in feed.entries[:max_per_query]:
                    title = _strip_html(entry.get("title", "")).strip()
                    link = entry.get("link", "")
                    summary = _strip_html(entry.get("description", entry.get("summary", "")))
                    if title:
                        _add(title, link, summary, f"X搜索: {query}", _parse_entry_time(entry))
            except Exception as e:
                logger.debug(f"X 搜索 '{query}' 失败: {e}")
                continue

        # 2. AI 关键人物账号动态
        for username, display in X_AI_KEY_ACCOUNTS:
            if username == "OpenAI":
                continue  # 已在上面抓取
            try:
                resp = client.get(f"https://{working}/{username}/rss")
                if resp.status_code != 200:
                    continue
                feed = feedparser.parse(resp.content)
                for entry in feed.entries[:max_per_account]:
                    title = _strip_html(entry.get("title", "")).strip()
                    link = entry.get("link", "")
                    summary = _strip_html(entry.get("description", entry.get("summary", "")))
                    if title:
                        _add(f"@{username}: {title[:150]}", link, summary, f"X @{display}", _parse_entry_time(entry))
            except Exception:
                continue

    logger.info(f"X/Twitter AI 话题抓取完毕，共 {len(items)} 条")
    return items


def _x_google_news_fallback(items: list[dict], seen_urls: set[str], client: httpx.Client):
    """当 Nitter 不可用时，通过 Google News 搜索 Twitter/X AI 热门内容"""
    fallback_feeds = [
        ("Google News AI (X)", "https://news.google.com/rss/search?q=AI+%22announced+on+X%22+OR+%22tweeted%22+OR+%22posted+on+X%22&hl=en-US&gl=US&ceid=US:en"),
        ("Google News AI热点", "https://news.google.com/rss/search?q=AI+%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD+%E5%8F%91%E5%B8%83&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"),
    ]
    for name, rss_url in fallback_feeds:
        try:
            resp = client.get(rss_url)
            if resp.status_code != 200:
                continue
            feed = feedparser.parse(resp.content)
            for entry in feed.entries[:8]:
                title = entry.get("title", "").strip()
                link = entry.get("link", "")
                summary = _strip_html(entry.get("description", entry.get("summary", "")))[:500]
                if title and link and link not in seen_urls:
                    seen_urls.add(link)
                    items.append({
                        "title": title[:200],
                        "url": link,
                        "summary": summary,
                        "source_name": name,
                        "published_at": _parse_entry_time(entry),
                    })
        except Exception as e:
            logger.debug(f"Google News 回退搜索失败 [{name}]: {e}")


# ─── 搜索引擎：DuckDuckGo ────────────────────────────────────────────────────────

def _search_duckduckgo(keyword: str, max_results: int = 10) -> list[dict]:
    """DuckDuckGo 新闻搜索（备用）"""
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


# ─── 搜索引擎：Bing News RSS ────────────────────────────────────────────────────

def _search_bing_news(keyword: str, max_results: int = 10) -> list[dict]:
    """Bing 新闻 RSS 搜索（国内可用，无需 Key）"""
    items = []
    try:
        encoded = quote_plus(keyword)
        rss_url = f"https://www.bing.com/news/search?q={encoded}&format=rss&count={max_results}"
        feed = feedparser.parse(rss_url)
        for entry in feed.entries[:max_results]:
            title = entry.get("title", "").strip()
            link = entry.get("link", "")
            summary = _strip_html(entry.get("summary", entry.get("description", "")))[:500]
            if title and link:
                items.append({
                    "title": title,
                    "url": link,
                    "summary": summary,
                    "source_name": "Bing News",
                    "published_at": _parse_entry_time(entry),
                })
    except Exception as e:
        logger.warning(f"Bing News 搜索失败 [{keyword}]: {e}")
    logger.info(f"Bing News 搜索 '{keyword}'，共 {len(items)} 条")
    return items


# ─── 搜索引擎：百度新闻 ─────────────────────────────────────────────────────────

def _search_baidu_news(keyword: str, max_results: int = 10) -> list[dict]:
    """百度新闻搜索（抓取结果页）"""
    items = []
    try:
        encoded = quote_plus(keyword)
        url = f"https://www.baidu.com/s?tn=news&rtt=1&bsst=1&cl=2&wd={encoded}"
        with httpx.Client(timeout=15, headers=_HEADERS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            html = resp.text

        # 解析百度新闻结果
        title_pattern = r'<h3 class="news-title[^"]*">.*?<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>'
        matches = re.findall(title_pattern, html, re.DOTALL)
        for link, raw_title in matches[:max_results]:
            title = _strip_html(raw_title).strip()
            if title and link:
                items.append({
                    "title": title,
                    "url": link,
                    "summary": "",
                    "source_name": "百度新闻",
                    "published_at": datetime.utcnow(),
                })
    except Exception as e:
        logger.warning(f"百度新闻搜索失败 [{keyword}]: {e}")
    logger.info(f"百度新闻搜索 '{keyword}'，共 {len(items)} 条")
    return items


# ─── 搜索引擎：今日头条 ─────────────────────────────────────────────────────────

def _search_toutiao(keyword: str, max_results: int = 10) -> list[dict]:
    """今日头条搜索（抓取 API）"""
    items = []
    try:
        encoded = quote_plus(keyword)
        api_url = f"https://www.toutiao.com/api/search/content/?keyword={encoded}&pd=information&source=input&dvpf=pc&aid=24&offset=0&count={max_results}"
        with httpx.Client(timeout=15, headers=_HEADERS, follow_redirects=True) as client:
            resp = client.get(api_url)
            resp.raise_for_status()
            data = resp.json()

        for item_data in data.get("data", [])[:max_results]:
            title = item_data.get("title", "").strip()
            article_url = item_data.get("article_url", "") or item_data.get("source_url", "")
            abstract = item_data.get("abstract", "")[:500]
            if title and article_url:
                if article_url.startswith("//"):
                    article_url = "https:" + article_url
                items.append({
                    "title": title,
                    "url": article_url,
                    "summary": abstract,
                    "source_name": "今日头条",
                    "published_at": datetime.utcnow(),
                })
    except Exception as e:
        logger.warning(f"今日头条搜索失败 [{keyword}]: {e}")
    logger.info(f"今日头条搜索 '{keyword}'，共 {len(items)} 条")
    return items


# ─── 聚合搜索（多引擎回退）────────────────────────────────────────────────────────

def search_keyword(keyword: str, max_results: int = 10) -> list[dict]:
    """多引擎聚合搜索：Bing News → 百度新闻 → 今日头条 → DuckDuckGo（回退）"""
    all_items: list[dict] = []
    seen_urls: set[str] = set()

    for search_fn in [_search_bing_news, _search_baidu_news, _search_toutiao, _search_duckduckgo]:
        try:
            results = search_fn(keyword, max_results=max_results)
            for item in results:
                if item["url"] not in seen_urls:
                    seen_urls.add(item["url"])
                    all_items.append(item)
        except Exception as e:
            logger.warning(f"搜索引擎调用失败: {e}")
            continue

    logger.info(f"聚合搜索 '{keyword}'，共 {len(all_items)} 条（去重后）")
    return all_items


# ─── 账号动态抓取 ────────────────────────────────────────────────────────────────

def fetch_account_updates(platform: str, account_id: str, display_name: str = "") -> list[dict]:
    """根据平台和账号 ID 抓取最新动态"""
    dispatch = {
        "bilibili": _fetch_bilibili,
        "zhihu": _fetch_zhihu,
        "weibo": _fetch_weibo,
        "twitter": _fetch_twitter,
        "github": _fetch_github_user,
    }
    fn = dispatch.get(platform)
    if not fn:
        logger.warning(f"不支持的平台: {platform}")
        return []
    try:
        return fn(account_id, display_name)
    except Exception as e:
        logger.warning(f"账号抓取失败 [{platform}/{account_id}]: {e}")
        return []


def _fetch_bilibili(uid: str, name: str) -> list[dict]:
    """B站用户动态（公开 API）"""
    items = []
    try:
        api = f"https://api.bilibili.com/x/space/dynamic/ailist?mid={uid}&ps=10"
        with httpx.Client(timeout=15, headers=_HEADERS) as client:
            resp = client.get(api)
            resp.raise_for_status()
            data = resp.json()
        for card in data.get("data", {}).get("items", []):
            modules = card.get("modules", {})
            major = modules.get("module_dynamic", {}).get("major", {})
            # 视频类型
            archive = major.get("archive", {})
            if archive:
                title = archive.get("title", "").strip()
                bvid = archive.get("bvid", "")
                desc = archive.get("desc", "")[:500]
                if title and bvid:
                    items.append({
                        "title": f"[B站] {name or uid}: {title}",
                        "url": f"https://www.bilibili.com/video/{bvid}",
                        "summary": desc,
                        "source_name": f"B站 @{name or uid}",
                        "published_at": datetime.utcnow(),
                    })
            # 图文类型
            article = major.get("article", {})
            if article:
                title = article.get("title", "").strip()
                art_id = article.get("id", "")
                if title:
                    items.append({
                        "title": f"[B站] {name or uid}: {title}",
                        "url": f"https://www.bilibili.com/read/cv{art_id}" if art_id else "",
                        "summary": article.get("desc", "")[:500],
                        "source_name": f"B站 @{name or uid}",
                        "published_at": datetime.utcnow(),
                    })
    except Exception as e:
        logger.warning(f"B站动态抓取失败 [{uid}]: {e}")
    logger.info(f"B站动态 '{name or uid}'，共 {len(items)} 条")
    return items


def _fetch_zhihu(user_id: str, name: str) -> list[dict]:
    """知乎用户最新内容（公开页面）"""
    items = []
    try:
        url = f"https://www.zhihu.com/api/v4/members/{user_id}/activities?limit=10"
        headers = {**_HEADERS, "Referer": "https://www.zhihu.com/"}
        with httpx.Client(timeout=15, headers=headers, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
        for activity in data.get("data", []):
            target = activity.get("target", {})
            act_type = target.get("type", "")
            title = ""
            link = ""
            excerpt = ""
            if act_type == "answer":
                question = target.get("question", {})
                title = question.get("title", "")
                link = f"https://www.zhihu.com/question/{question.get('id', '')}/answer/{target.get('id', '')}"
                excerpt = target.get("excerpt", "")[:500]
            elif act_type == "article":
                title = target.get("title", "")
                link = target.get("url", "").replace("api.zhihu.com/articles", "zhuanlan.zhihu.com/p")
                excerpt = target.get("excerpt", "")[:500]
            if title and link:
                items.append({
                    "title": f"[知乎] {name or user_id}: {title}",
                    "url": link,
                    "summary": excerpt,
                    "source_name": f"知乎 @{name or user_id}",
                    "published_at": datetime.utcnow(),
                })
    except Exception as e:
        logger.warning(f"知乎抓取失败 [{user_id}]: {e}")
    logger.info(f"知乎动态 '{name or user_id}'，共 {len(items)} 条")
    return items


def _fetch_weibo(uid: str, name: str) -> list[dict]:
    """微博用户最新微博（移动版页面）"""
    items = []
    try:
        api = f"https://m.weibo.cn/api/container/getIndex?containerid=107603{uid}&type=uid&value={uid}"
        with httpx.Client(timeout=15, headers=_HEADERS, follow_redirects=True) as client:
            resp = client.get(api)
            resp.raise_for_status()
            data = resp.json()
        for card in data.get("data", {}).get("cards", []):
            mblog = card.get("mblog", {})
            if not mblog:
                continue
            text = _strip_html(mblog.get("text", ""))[:500]
            mid = mblog.get("mid", "")
            if text and mid:
                # 取前30字做标题
                title_text = text[:60] + ("..." if len(text) > 60 else "")
                items.append({
                    "title": f"[微博] {name or uid}: {title_text}",
                    "url": f"https://m.weibo.cn/detail/{mid}",
                    "summary": text,
                    "source_name": f"微博 @{name or uid}",
                    "published_at": datetime.utcnow(),
                })
    except Exception as e:
        logger.warning(f"微博抓取失败 [{uid}]: {e}")
    logger.info(f"微博动态 '{name or uid}'，共 {len(items)} 条")
    return items


def _fetch_twitter(username: str, name: str) -> list[dict]:
    """Twitter/X 抓取（通过 Nitter 公共 RSS 实例）"""
    items = []
    # 多个 Nitter 实例，逐个试
    nitter_instances = [f"https://{inst}/{username}/rss" for inst in NITTER_INSTANCES]
    for rss_url in nitter_instances:
        try:
            feed = feedparser.parse(rss_url)
            if not feed.entries:
                continue
            for entry in feed.entries[:10]:
                title = entry.get("title", "").strip()
                link = entry.get("link", "")
                # Nitter 链接转 Twitter 链接
                if "nitter" in link:
                    link = link.split("nitter")[0] + f"twitter.com/{username}/status/" + link.split("/status/")[-1] if "/status/" in link else link
                summary = _strip_html(entry.get("summary", ""))[:500]
                if title and link:
                    items.append({
                        "title": f"[X] @{name or username}: {title[:80]}",
                        "url": link,
                        "summary": summary,
                        "source_name": f"X @{name or username}",
                        "published_at": _parse_entry_time(entry),
                    })
            if items:
                break  # 成功抓到就不再试下一个实例
        except Exception:
            continue
    if not items:
        logger.warning(f"Twitter/Nitter 所有实例抓取失败 [{username}]")
    else:
        logger.info(f"Twitter 动态 '{name or username}'，共 {len(items)} 条")
    return items


def _fetch_github_user(username: str, name: str) -> list[dict]:
    """GitHub 用户/组织的公开活动（Atom Feed）"""
    items = []
    try:
        atom_url = f"https://github.com/{username}.atom"
        feed = feedparser.parse(atom_url)
        for entry in feed.entries[:10]:
            title = entry.get("title", "").strip()
            link = entry.get("link", "")
            summary = _strip_html(entry.get("summary", entry.get("content", [{}])[0].get("value", "") if entry.get("content") else ""))[:500]
            if title and link:
                items.append({
                    "title": f"[GitHub] {name or username}: {title}",
                    "url": link,
                    "summary": summary,
                    "source_name": f"GitHub @{name or username}",
                    "published_at": _parse_entry_time(entry),
                })
    except Exception as e:
        logger.warning(f"GitHub 抓取失败 [{username}]: {e}")
    logger.info(f"GitHub 动态 '{name or username}'，共 {len(items)} 条")
    return items
