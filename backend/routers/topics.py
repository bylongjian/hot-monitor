from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, or_, select
from backend.database import get_db
from backend.models import Topic
from backend.schemas import TopicOut, ScanResponse
from backend.services.scheduler import is_scan_running, trigger_scan_now

router = APIRouter(prefix="/api/v1/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
async def list_topics(
    limit: int = 50,
    offset: int = 0,
    min_heat: int = 1,
    sort: str = Query("newest", pattern=r"^(newest|heat|matched|unnotified)$"),
    source_names: str | None = None,
    keyword_mode: str = Query("all", pattern=r"^(all|matched|unmatched)$"),
    time_range: str = Query("all", pattern=r"^(all|6h|24h|48h|7d)$"),
    tag: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Topic).where(Topic.heat_score >= min_heat)

    parsed_sources = [item.strip() for item in (source_names or "").split(",") if item.strip()]
    if parsed_sources:
        query = query.where(Topic.source_name.in_(parsed_sources))

    if keyword_mode == "matched":
        query = query.where(Topic.keyword_id.is_not(None))
    elif keyword_mode == "unmatched":
        query = query.where(Topic.keyword_id.is_(None))

    if time_range != "all":
        hours_map = {
            "6h": 6,
            "24h": 24,
            "48h": 48,
            "7d": 24 * 7,
        }
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=hours_map[time_range])
        query = query.where(Topic.discovered_at >= cutoff)

    trimmed_tag = (tag or "").strip()
    if trimmed_tag:
        query = query.where(Topic._tags.like(f'%"{trimmed_tag}"%'))

    trimmed_query = (q or "").strip().lower()
    if trimmed_query:
        search_term = f"%{trimmed_query}%"
        query = query.where(
            or_(
                Topic.title.ilike(search_term),
                Topic.summary.ilike(search_term),
            )
        )

    if sort == "heat":
        query = query.order_by(Topic.heat_score.desc(), Topic.discovered_at.desc())
    elif sort == "matched":
        query = query.order_by(
            case((Topic.keyword_id.is_not(None), 0), else_=1),
            Topic.discovered_at.desc(),
        )
    elif sort == "unnotified":
        query = query.order_by(
            case((Topic.is_notified.is_(False), 0), else_=1),
            Topic.discovered_at.desc(),
        )
    else:
        query = query.order_by(Topic.discovered_at.desc())

    result = await db.execute(query.offset(offset).limit(limit))
    topics = result.scalars().all()
    out = []
    for t in topics:
        out.append(TopicOut(
            id=t.id,
            title=t.title,
            summary=t.summary,
            source_url=t.source_url,
            source_name=t.source_name,
            heat_score=t.heat_score,
            tags=t.tags,
            is_notified=t.is_notified,
            keyword_id=t.keyword_id,
            discovered_at=t.discovered_at,
        ))
    return out


@router.get("/{topic_id}", response_model=TopicOut)
async def get_topic(topic_id: int, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    t = await db.get(Topic, topic_id)
    if not t:
        raise HTTPException(status_code=404, detail="热点不存在")
    return TopicOut(
        id=t.id,
        title=t.title,
        summary=t.summary,
        source_url=t.source_url,
        source_name=t.source_name,
        heat_score=t.heat_score,
        tags=t.tags,
        is_notified=t.is_notified,
        keyword_id=t.keyword_id,
        discovered_at=t.discovered_at,
    )


@router.post("/scan", response_model=ScanResponse)
async def manual_scan(background_tasks: BackgroundTasks):
    if await is_scan_running():
        return ScanResponse(message="已有扫描任务正在执行，请稍后查看结果", triggered=False)
    background_tasks.add_task(trigger_scan_now)
    return ScanResponse(message="扫描任务已触发，正在后台执行", triggered=True)
