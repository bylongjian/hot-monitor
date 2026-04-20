import logging
import asyncio
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.database import AsyncSessionLocal
from backend.config import get_settings
from backend.models import Topic, Keyword
from backend.services.crawler import fetch_rss_items, fetch_hn_items, search_keyword
from backend.services.ai_analyzer import analyze_topic, check_keyword_relevance
from backend.services.notifier import send_notification_email
from sqlalchemy import select

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="UTC")

# 已处理过的 URL 缓存（防止重复入库，重启后重置）
_seen_urls: set[str] = set()

NOTIFY_HEAT_THRESHOLD = 8  # 热度≥此值时发送通知（可被设置覆盖）


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
            )
            topic.tags = item.get("tags", [])
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


async def auto_discover_task():
    """自动发现热点（RSS + HN）"""
    logger.info("▶ 自动发现热点任务开始")
    settings = get_settings()
    items = []
    items.extend(fetch_rss_items(max_per_feed=8))
    items.extend(fetch_hn_items(limit=20, min_score=50))

    for item in items:
        # AI 分析
        analysis = analyze_topic(item["title"], item.get("summary", ""))
        if not analysis["is_genuine"]:
            continue
        item["heat_score"] = analysis["heat_score"]
        item["ai_summary"] = analysis["summary"]
        item["tags"] = analysis["tags"]

        topic = await _save_topic(item)
        if topic:
            await _notify_if_needed(topic)

    logger.info(f"▶ 自动发现热点任务完成，处理 {len(items)} 条")


async def keyword_monitor_task():
    """关键词监控任务"""
    logger.info("▶ 关键词监控任务开始")
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Keyword).where(Keyword.enabled == True)
        )
        keywords = result.scalars().all()

    for kw in keywords:
        results = search_keyword(kw.keyword, max_results=8)
        for item in results:
            # 先检查关键词相关性
            relevance = check_keyword_relevance(
                kw.keyword, item["title"], item.get("summary", "")
            )
            if not relevance["is_relevant"] or relevance["relevance_score"] < 5:
                continue

            # AI 分析热点属性
            analysis = analyze_topic(item["title"], item.get("summary", ""))
            if not analysis["is_genuine"]:
                continue
            item["heat_score"] = analysis["heat_score"]
            item["ai_summary"] = analysis["summary"]
            item["tags"] = analysis["tags"]

            topic = await _save_topic(item, keyword_id=kw.id)
            if topic:
                await _notify_if_needed(topic, keyword_name=kw.keyword)

        # 更新最后检查时间
        try:
            async with AsyncSessionLocal() as db:
                k = await db.get(Keyword, kw.id)
                if k:
                    k.last_checked_at = datetime.utcnow()
                    await db.commit()
        except Exception as e:
            logger.error(f"更新关键词检查时间失败: {e}")

    logger.info(f"▶ 关键词监控任务完成，检查 {len(keywords)} 个关键词")


def get_scheduler() -> AsyncIOScheduler:
    return scheduler


def start_scheduler(scan_interval_minutes: int = 60):
    """启动调度器，注册所有任务"""
    if scheduler.running:
        return

    scheduler.add_job(
        auto_discover_task,
        trigger=IntervalTrigger(minutes=scan_interval_minutes),
        id="auto_discover",
        replace_existing=True,
        name="自动发现热点",
    )
    scheduler.add_job(
        keyword_monitor_task,
        trigger=IntervalTrigger(minutes=scan_interval_minutes),
        id="keyword_monitor",
        replace_existing=True,
        name="关键词监控",
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
    for job_id in ["auto_discover", "keyword_monitor"]:
        job = scheduler.get_job(job_id)
        if job:
            job.reschedule(trigger=IntervalTrigger(minutes=minutes))
    logger.info(f"扫描间隔已更新为 {minutes} 分钟")


async def trigger_scan_now():
    """立即触发一次全量扫描"""
    logger.info("手动触发扫描")
    await asyncio.gather(
        auto_discover_task(),
        keyword_monitor_task(),
        return_exceptions=True,
    )
