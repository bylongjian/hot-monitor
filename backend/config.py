from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # OpenRouter
    OPENROUTER_API_KEY: str = ""
    AI_MODEL: str = "deepseek/deepseek-v3.2"

    # SMTP Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    NOTIFY_EMAIL: str = ""

    # App
    SECRET_KEY: str = "change-me-in-production"
    DATABASE_URL: str = "sqlite+aiosqlite:///./hot_monitor.db"
    DEFAULT_SCAN_INTERVAL: int = 60  # minutes
    MIN_HEAT_SCORE: int = 7  # 低于此分数的内容不入库


@lru_cache
def get_settings() -> Settings:
    return Settings()
