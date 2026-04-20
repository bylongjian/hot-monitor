from datetime import datetime
from pydantic import BaseModel, Field


# ─── Keyword ───────────────────────────────────────────────────────────────────

class KeywordCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    enabled: bool = True


class KeywordUpdate(BaseModel):
    keyword: str | None = Field(None, min_length=1, max_length=200)
    enabled: bool | None = None


class KeywordOut(BaseModel):
    id: int
    keyword: str
    enabled: bool
    last_checked_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Topic ─────────────────────────────────────────────────────────────────────

class TopicOut(BaseModel):
    id: int
    title: str
    summary: str | None
    source_url: str
    source_name: str
    heat_score: int
    tags: list[str]
    is_notified: bool
    keyword_id: int | None
    discovered_at: datetime

    model_config = {"from_attributes": True}


# ─── Settings KV ───────────────────────────────────────────────────────────────

class SettingsPayload(BaseModel):
    scan_interval: int | None = Field(None, ge=10, le=1440)
    notify_email: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    openrouter_api_key: str | None = None
    ai_model: str | None = None
    notify_heat_threshold: int | None = Field(None, ge=1, le=10)


class SettingsOut(BaseModel):
    scan_interval: int
    notify_email: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    ai_model: str
    notify_heat_threshold: int
    # smtp_password and openrouter_api_key omitted intentionally


# ─── Misc ──────────────────────────────────────────────────────────────────────

class ScanResponse(BaseModel):
    message: str
    triggered: bool


class StatusOut(BaseModel):
    scheduler_running: bool
    next_run: str | None
    total_topics: int
    total_keywords: int
