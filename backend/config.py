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
    SECRET_KEY: str = "dev-secret-key"
    DATABASE_URL: str = "sqlite+aiosqlite:///./hot_monitor.db"
    DEFAULT_SCAN_INTERVAL: int = 60  # minutes


@lru_cache
def get_settings() -> Settings:
    return Settings()
