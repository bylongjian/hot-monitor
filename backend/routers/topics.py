from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Topic)
        .where(Topic.heat_score >= min_heat)
        .order_by(Topic.discovered_at.desc())
        .offset(offset)
        .limit(limit)
    )
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
