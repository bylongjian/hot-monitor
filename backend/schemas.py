from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_serializer


def normalize_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# ─── Keyword ───────────────────────────────────────────────────────────────────

class KeywordCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=200)
    enabled: bool = True
    type: str = Field("keyword", pattern=r"^(keyword|account)$")
    platform: str | None = Field(None, max_length=50)
    account_id: str | None = Field(None, max_length=200)


class KeywordUpdate(BaseModel):
    keyword: str | None = Field(None, min_length=1, max_length=200)
    enabled: bool | None = None
    type: str | None = Field(None, pattern=r"^(keyword|account)$")
    platform: str | None = None
    account_id: str | None = None


class KeywordOut(BaseModel):
    id: int
    keyword: str
    enabled: bool
    type: str
    platform: str | None
    account_id: str | None
    last_checked_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("last_checked_at", "created_at")
    def serialize_keyword_datetime(self, value: datetime | None):
        return normalize_utc_datetime(value)


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

    @field_serializer("discovered_at")
    def serialize_topic_datetime(self, value: datetime):
        return normalize_utc_datetime(value)


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
    min_heat_score: int | None = Field(None, ge=1, le=10)


class SettingsOut(BaseModel):
    scan_interval: int
    notify_email: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    ai_model: str
    notify_heat_threshold: int
    min_heat_score: int
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
    scan_running: bool
    scan_started_at: datetime | None
    scan_finished_at: datetime | None
    last_scan_success_at: datetime | None
    last_scan_duration_seconds: float | None
    last_scan_error: str | None

    @field_serializer("scan_started_at", "scan_finished_at", "last_scan_success_at")
    def serialize_status_datetime(self, value: datetime | None):
        return normalize_utc_datetime(value)
