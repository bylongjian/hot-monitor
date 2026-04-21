import logging
import asyncio
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.database import AsyncSessionLocal
from backend.config import get_settings
from backend.models import Topic, Keyword
from backend.services.crawler import (
    fetch_rss_items, fetch_hn_items, fetch_reddit_items,
    fetch_github_trending, fetch_x_ai_topics, search_keyword,
    fetch_account_updates,
)
from backend.services.ai_analyzer import analyze_topic, check_keyword_relevance
from backend.services.notifier import send_notification_email
from sqlalchemy import select

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")

# 已处理过的 URL 缓存（防止重复入库，重启后重置）
_seen_urls: set[str] = set()
_scan_state_lock = asyncio.Lock()
_scan_state: dict[str, object | None] = {
    "is_running": False,
    "started_at": None,
    "finished_at": None,
    "last_success_at": None,
    "last_duration_seconds": None,
    "last_error": None,
}

NOTIFY_HEAT_THRESHOLD = 8  # 热度≥此值时发送通知（可被设置覆盖）


def _normalize_metric_dict(metrics: dict | None) -> dict:
    if not isinstance(metrics, dict):
        return {}
    normalized = {}
    for key, value in metrics.items():
        if value is None:
            continue
        normalized[str(key)] = value
    return normalized


async def _update_scan_state(**updates):
    async with _scan_state_lock:
        _scan_state.update(updates)


async def get_scan_status() -> dict[str, object | None]:
    async with _scan_state_lock:
        return dict(_scan_state)


async def is_scan_running() -> bool:
    async with _scan_state_lock:
        return bool(_scan_state["is_running"])


async def _get_setting_int(key: str, default: int) -> int:
    try:
        async with AsyncSessionLocal() as db:
            from backend.models import Setting
            row = await db.get(Setting, key)
            if row:
                return int(row.value)
    except Exception:
        pass
    return default


async def _save_topic(item: dict, keyword_id: int | None = None) -> Topic | None:
    """保存一条热点到数据库（去重）"""
    url = item.get("url", "")
    if not url or url in _seen_urls:
        return None

    try:
        async with AsyncSessionLocal() as db:
            # DB 层去重
            existing = await db.execute(select(Topic).where(Topic.source_url == url))
            if existing.scalar_one_or_none():
                _seen_urls.add(url)
                return None

            topic = Topic(
                title=item["title"],
                summary=item.get("ai_summary") or item.get("summary", ""),
                source_url=url,
                source_name=item.get("source_name", "Unknown"),
                heat_score=item.get("heat_score", 5),
                keyword_id=keyword_id,
                raw_content=item.get("summary", "")[:2000],
                published_at=item.get("published_at"),
                relevance_score=item.get("relevance_score"),
                relevance_reason=item.get("relevance_reason"),
            )
            topic.tags = item.get("tags", [])
            topic.engagement = _normalize_metric_dict(item.get("engagement"))
            topic.source_metrics = _normalize_metric_dict(item.get("source_metrics"))
            db.add(topic)
            await db.commit()
            await db.refresh(topic)
            _seen_urls.add(url)
            logger.info(f"新热点入库: [{topic.heat_score}分] {topic.title[:60]}")
            return topic
    except Exception as e:
        logger.error(f"热点入库失败: {e}")
        return None


async def _notify_if_needed(topic: Topic, keyword_name: str = ""):
    """热度达标时发送通知"""
    threshold = await _get_setting_int("notify_heat_threshold", NOTIFY_HEAT_THRESHOLD)
    if topic.heat_score >= threshold and not topic.is_notified:
        topic_data = {
            "title": topic.title,
            "summary": topic.summary or "",
            "source_url": topic.source_url,
            "source_name": topic.source_name,
            "heat_score": topic.heat_score,
            "tags": topic.tags,
            "trigger_keyword": keyword_name,
        }
        success = await send_notification_email(topic_data)
        if success:
            try:
                async with AsyncSessionLocal() as db:
                    t = await db.get(Topic, topic.id)
                    if t:
                        t.is_notified = True
                        await db.commit()
            except Exception as e:
                logger.error(f"更新通知状态失败: {e}")


async def _is_url_duplicate(url: str) -> bool:
    """检查 URL 是否已存在（内存缓存 + DB 查询）"""
    if not url or url in _seen_urls:
        return True
    try:
        async with AsyncSessionLocal() as db:
            existing = await db.execute(select(Topic).where(Topic.source_url == url))
            if existing.scalar_one_or_none():
                _seen_urls.add(url)
                return True
    except Exception:
        pass
    return False


# AI 并发限制信号量
_ai_semaphore = asyncio.Semaphore(5)
_keyword_monitor_semaphore = asyncio.Semaphore(3)


async def _analyze_and_save(item: dict, min_heat: int, keyword_id: int | None = None, keyword_name: str = "") -> bool:
    """对单条 item 执行 AI 分析并保存，返回是否成功入库"""
    async with _ai_semaphore:
        analysis = await asyncio.to_thread(
            analyze_topic, item["title"], item.get("summary", "")
        )
    if not analysis["is_genuine"]:
        return False
    if analysis["heat_score"] < min_heat:
        return False
    item["heat_score"] = analysis["heat_score"]
    item["ai_summary"] = analysis["summary"]
    item["tags"] = analysis["tags"]

    topic = await _save_topic(item, keyword_id=keyword_id)
    if topic:
        await _notify_if_needed(topic, keyword_name=keyword_name)
        return True
    return False


async def auto_discover_task():
    """自动发现热点（X/Twitter + RSS + HN + Reddit + GitHub Trending）"""
    logger.info("▶ 自动发现热点任务开始")
    min_heat = await _get_setting_int("min_heat_score", 7)

    # 并行抓取所有数据源
    x_task = asyncio.to_thread(fetch_x_ai_topics)
    rss_task = asyncio.to_thread(fetch_rss_items, max_per_feed=8)
    hn_task = asyncio.to_thread(fetch_hn_items, limit=20, min_score=200, min_comments=30)
    reddit_task = asyncio.to_thread(fetch_reddit_items, min_score=100, min_comments=20)
    github_task = asyncio.to_thread(fetch_github_trending)

    results = await asyncio.gather(x_task, rss_task, hn_task, reddit_task, github_task, return_exceptions=True)

    items = []
    for r in results:
        if isinstance(r, Exception):
            logger.error(f"数据源抓取异常: {r}")
        else:
            items.extend(r)

    # 预去重：在调用 AI 之前过滤已存在的 URL
    new_items = []
    for item in items:
        if not await _is_url_duplicate(item.get("url", "")):
            new_items.append(item)

    # 时效性过滤：丢弃超过 48 小时的旧内容
    cutoff = datetime.utcnow() - timedelta(hours=48)
    before_fresh = len(new_items)
    new_items = [
        it for it in new_items
        if it.get("published_at") is None or it["published_at"] >= cutoff
    ]
    stale = before_fresh - len(new_items)
    logger.info(f"抓取 {len(items)} 条，去重后 {before_fresh} 条，过滤旧内容 {stale} 条，待分析 {len(new_items)} 条")

    # 并发 AI 分析（受信号量限制，最多 5 个并发）
    tasks = [_analyze_and_save(item, min_heat) for item in new_items]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    saved = sum(1 for r in results if r is True)

    logger.info(f"▶ 自动发现热点任务完成，处理 {len(new_items)} 条，入库 {saved} 条（最低热度 {min_heat}）")


async def _keyword_analyze_and_save(item: dict, kw, min_heat: int) -> bool:
    """关键词监控：相关性检查 + AI 分析 + 保存"""
    async with _ai_semaphore:
        if kw.type != "account":
            relevance = await asyncio.to_thread(
                check_keyword_relevance,
                kw.keyword, item["title"], item.get("summary", "")
            )
            if not relevance["is_relevant"] or relevance["relevance_score"] < 5:
                return False
            item["relevance_score"] = relevance["relevance_score"]
            item["relevance_reason"] = relevance.get("reason")

    return await _analyze_and_save(item, min_heat, keyword_id=kw.id, keyword_name=kw.keyword)


async def _process_keyword(kw, min_heat: int):
    async with _keyword_monitor_semaphore:
        # 根据类型选择抓取方式（在线程池中运行）
        if kw.type == "account" and kw.platform and kw.account_id:
            results = await asyncio.to_thread(
                fetch_account_updates, kw.platform, kw.account_id, kw.keyword
            )
        else:
            results = await asyncio.to_thread(search_keyword, kw.keyword, max_results=8)

        # 预去重
        new_items = []
        for item in results:
            if not await _is_url_duplicate(item.get("url", "")):
                new_items.append(item)

        # 并发 AI 分析
        tasks = [_keyword_analyze_and_save(item, kw, min_heat) for item in new_items]
        await asyncio.gather(*tasks, return_exceptions=True)

        # 更新最后检查时间
        try:
            async with AsyncSessionLocal() as db:
                k = await db.get(Keyword, kw.id)
                if k:
                    k.last_checked_at = datetime.utcnow()
                    await db.commit()
        except Exception as e:
            logger.error(f"更新关键词检查时间失败: {e}")


async def keyword_monitor_task():
    """关键词/账号监控任务"""
    logger.info("▶ 关键词监控任务开始")
    min_heat = await _get_setting_int("min_heat_score", 7)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Keyword).where(Keyword.enabled == True)
        )
        keywords = result.scalars().all()

    await asyncio.gather(*[_process_keyword(kw, min_heat) for kw in keywords], return_exceptions=True)

    logger.info(f"▶ 关键词监控任务完成，检查 {len(keywords)} 个关键词")


def get_scheduler() -> AsyncIOScheduler:
    return scheduler


async def _run_scan_cycle(source: str):
    if await is_scan_running():
        logger.info(f"{source} 扫描请求被忽略：已有扫描任务正在执行")
        return False

    started_at = datetime.utcnow()
    await _update_scan_state(
        is_running=True,
        started_at=started_at,
        last_error=None,
    )
    logger.info(f"{source} 扫描开始")

    try:
        results = await asyncio.gather(
            auto_discover_task(),
            keyword_monitor_task(),
            return_exceptions=True,
        )
        errors = [str(result) for result in results if isinstance(result, Exception)]
        finished_at = datetime.utcnow()
        duration = round((finished_at - started_at).total_seconds(), 2)
        await _update_scan_state(
            is_running=False,
            finished_at=finished_at,
            last_success_at=None if errors else finished_at,
            last_duration_seconds=duration,
            last_error=" | ".join(errors[:3]) if errors else None,
        )
        if errors:
            logger.error(f"{source} 扫描完成，但存在异常: {' | '.join(errors[:3])}")
        return not errors
    except Exception as exc:
        finished_at = datetime.utcnow()
        duration = round((finished_at - started_at).total_seconds(), 2)
        await _update_scan_state(
            is_running=False,
            finished_at=finished_at,
            last_duration_seconds=duration,
            last_error=str(exc),
        )
        logger.exception(f"{source} 扫描执行失败")
        return False


async def scheduled_scan_job():
    """调度器统一扫描入口"""
    await _run_scan_cycle("定时")


def start_scheduler(scan_interval_minutes: int = 60):
    """启动调度器，注册所有任务"""
    if scheduler.running:
        return

    scheduler.add_job(
        scheduled_scan_job,
        trigger=IntervalTrigger(minutes=scan_interval_minutes),
        id="scan_runner",
        replace_existing=True,
        name="全量扫描",
    )
    scheduler.start()
    logger.info(f"调度器已启动，扫描间隔：{scan_interval_minutes} 分钟")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("调度器已停止")


def update_scan_interval(minutes: int):
    """动态更新扫描间隔"""
    if not scheduler.running:
        return
    job = scheduler.get_job("scan_runner")
    if job:
        job.reschedule(trigger=IntervalTrigger(minutes=minutes))
    logger.info(f"扫描间隔已更新为 {minutes} 分钟")


async def trigger_scan_now():
    """立即触发一次全量扫描"""
    return await _run_scan_cycle("手动")
