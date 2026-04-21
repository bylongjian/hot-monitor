import json
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.database import get_db
from backend.models import Setting, Topic, Keyword
from backend.schemas import SettingsPayload, SettingsOut, StatusOut
from backend.config import get_settings
from backend.services.scheduler import get_scheduler, get_scan_status, update_scan_interval
from backend.services.notifier import send_test_email

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

DEFAULT_SETTINGS = {
    "scan_interval": "60",
    "notify_email": "",
    "smtp_host": "smtp.gmail.com",
    "smtp_port": "587",
    "smtp_user": "",
    "smtp_password": "",
    "openrouter_api_key": "",
    "ai_model": "deepseek/deepseek-v3.2",
    "notify_heat_threshold": "8",
    "min_heat_score": "7",
}


async def _get_all_settings(db: AsyncSession) -> dict:
    result = await db.execute(select(Setting))
    rows = {r.key: r.value for r in result.scalars().all()}
    merged = {**DEFAULT_SETTINGS}
    # Overlay with env values
    env = get_settings()
    if env.NOTIFY_EMAIL:
        merged["notify_email"] = env.NOTIFY_EMAIL
    if env.SMTP_HOST:
        merged["smtp_host"] = env.SMTP_HOST
    if env.SMTP_USER:
        merged["smtp_user"] = env.SMTP_USER
    merged["smtp_port"] = str(env.SMTP_PORT)
    if env.AI_MODEL:
        merged["ai_model"] = env.AI_MODEL
    merged["scan_interval"] = str(env.DEFAULT_SCAN_INTERVAL)
    # DB overrides env
    merged.update(rows)
    return merged


@router.get("", response_model=SettingsOut)
async def get_settings_api(db: AsyncSession = Depends(get_db)):
    s = await _get_all_settings(db)
    return SettingsOut(
        scan_interval=int(s.get("scan_interval", 60)),
        notify_email=s.get("notify_email", ""),
        smtp_host=s.get("smtp_host", ""),
        smtp_port=int(s.get("smtp_port", 587)),
        smtp_user=s.get("smtp_user", ""),
        ai_model=s.get("ai_model", "deepseek/deepseek-v3.2"),
        notify_heat_threshold=int(s.get("notify_heat_threshold", 8)),
        min_heat_score=int(s.get("min_heat_score", 7)),
    )


@router.put("", response_model=SettingsOut)
async def update_settings_api(payload: SettingsPayload, db: AsyncSession = Depends(get_db)):
    updates: dict[str, str] = {}
    if payload.scan_interval is not None:
        updates["scan_interval"] = str(payload.scan_interval)
    if payload.notify_email is not None:
        updates["notify_email"] = payload.notify_email
    if payload.smtp_host is not None:
        updates["smtp_host"] = payload.smtp_host
    if payload.smtp_port is not None:
        updates["smtp_port"] = str(payload.smtp_port)
    if payload.smtp_user is not None:
        updates["smtp_user"] = payload.smtp_user
    if payload.smtp_password is not None:
        updates["smtp_password"] = payload.smtp_password
    if payload.openrouter_api_key is not None:
        updates["openrouter_api_key"] = payload.openrouter_api_key
    if payload.ai_model is not None:
        updates["ai_model"] = payload.ai_model
    if payload.notify_heat_threshold is not None:
        updates["notify_heat_threshold"] = str(payload.notify_heat_threshold)
    if payload.min_heat_score is not None:
        updates["min_heat_score"] = str(payload.min_heat_score)

    from datetime import datetime
    now = datetime.utcnow()
    for key, value in updates.items():
        existing = await db.get(Setting, key)
        if existing:
            existing.value = value
            existing.updated_at = now
        else:
            db.add(Setting(key=key, value=value, updated_at=now))
    await db.commit()

    # 动态更新调度器间隔
    if payload.scan_interval is not None:
        update_scan_interval(payload.scan_interval)

    # 更新 config 缓存（需要重新加载环境变量中的值会被 DB 覆盖）
    import os
    if payload.openrouter_api_key:
        os.environ["OPENROUTER_API_KEY"] = payload.openrouter_api_key
        get_settings.cache_clear()
    if payload.ai_model:
        os.environ["AI_MODEL"] = payload.ai_model
        get_settings.cache_clear()
    if payload.smtp_user:
        os.environ["SMTP_USER"] = payload.smtp_user
        get_settings.cache_clear()
    if payload.smtp_password:
        os.environ["SMTP_PASSWORD"] = payload.smtp_password
        get_settings.cache_clear()
    if payload.notify_email:
        os.environ["NOTIFY_EMAIL"] = payload.notify_email
        get_settings.cache_clear()

    return await get_settings_api(db)


@router.post("/test-email")
async def test_email():
    success = await send_test_email()
    if success:
        return {"message": "测试邮件已发送，请检查收件箱"}
    return {"message": "发送失败，请检查 SMTP 配置"}


@router.get("/status", response_model=StatusOut)
async def get_status(db: AsyncSession = Depends(get_db)):
    sched = get_scheduler()
    scan_status = await get_scan_status()
    next_run = None
    if sched.running:
        job = sched.get_job("scan_runner")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()

    total_topics = await db.scalar(select(func.count(Topic.id))) or 0
    total_keywords = await db.scalar(select(func.count(Keyword.id))) or 0

    return StatusOut(
        scheduler_running=sched.running,
        next_run=next_run,
        total_topics=total_topics,
        total_keywords=total_keywords,
        scan_running=bool(scan_status["is_running"]),
        scan_started_at=scan_status["started_at"],
        scan_finished_at=scan_status["finished_at"],
        last_scan_success_at=scan_status["last_success_at"],
        last_scan_duration_seconds=scan_status["last_duration_seconds"],
        last_scan_error=scan_status["last_error"],
    )
