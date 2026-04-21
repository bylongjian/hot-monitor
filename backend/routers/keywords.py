from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select
from backend.database import get_db
from backend.models import Keyword, Topic
from backend.schemas import KeywordCreate, KeywordUpdate, KeywordOut, TopicOut
from backend.routers.topics import _build_topic_out

router = APIRouter(prefix="/api/v1/keywords", tags=["keywords"])


@router.get("", response_model=list[KeywordOut])
async def list_keywords(
    enabled: str = Query("all", pattern=r"^(all|enabled|disabled)$"),
    type: str = Query("all", pattern=r"^(all|keyword|account)$"),
    platform: str | None = None,
    search: str | None = None,
    sort: str = Query("created_desc", pattern=r"^(created_desc|created_asc)$"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Keyword)

    if enabled == "enabled":
        query = query.where(Keyword.enabled.is_(True))
    elif enabled == "disabled":
        query = query.where(Keyword.enabled.is_(False))

    if type != "all":
        query = query.where(Keyword.type == type)

    trimmed_platform = (platform or "").strip()
    if trimmed_platform:
        query = query.where(Keyword.platform == trimmed_platform)

    trimmed_search = (search or "").strip()
    if trimmed_search:
        search_term = f"%{trimmed_search}%"
        query = query.where(
            or_(
                Keyword.keyword.ilike(search_term),
                Keyword.account_id.ilike(search_term),
            )
        )

    if sort == "created_asc":
        query = query.order_by(Keyword.created_at.asc())
    else:
        query = query.order_by(Keyword.created_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=KeywordOut, status_code=status.HTTP_201_CREATED)
async def create_keyword(payload: KeywordCreate, db: AsyncSession = Depends(get_db)):
    # 检查是否已存在
    existing = await db.execute(select(Keyword).where(Keyword.keyword == payload.keyword))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="关键词已存在")
    kw = Keyword(keyword=payload.keyword, enabled=payload.enabled,
                 type=payload.type, platform=payload.platform,
                 account_id=payload.account_id)
    db.add(kw)
    await db.commit()
    await db.refresh(kw)
    return kw


@router.patch("/{kw_id}", response_model=KeywordOut)
async def update_keyword(kw_id: int, payload: KeywordUpdate, db: AsyncSession = Depends(get_db)):
    kw = await db.get(Keyword, kw_id)
    if not kw:
        raise HTTPException(status_code=404, detail="关键词不存在")
    if payload.keyword is not None:
        kw.keyword = payload.keyword
    if payload.enabled is not None:
        kw.enabled = payload.enabled
    if payload.type is not None:
        kw.type = payload.type
    if payload.platform is not None:
        kw.platform = payload.platform
    if payload.account_id is not None:
        kw.account_id = payload.account_id
    await db.commit()
    await db.refresh(kw)
    return kw


@router.delete("/{kw_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_keyword(kw_id: int, db: AsyncSession = Depends(get_db)):
    kw = await db.get(Keyword, kw_id)
    if not kw:
        raise HTTPException(status_code=404, detail="关键词不存在")
    await db.delete(kw)
    await db.commit()


@router.get("/{kw_id}/hits", response_model=list[TopicOut])
async def keyword_hits(
    kw_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    kw = await db.get(Keyword, kw_id)
    if not kw:
        raise HTTPException(status_code=404, detail="关键词不存在")
    result = await db.execute(
        select(Topic)
        .where(Topic.keyword_id == kw_id)
        .order_by(Topic.discovered_at.desc())
        .limit(limit)
    )
    topics = result.scalars().all()
    return [_build_topic_out(topic) for topic in topics]
