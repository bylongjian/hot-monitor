import json
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Keyword(Base):
    __tablename__ = "keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    keyword: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    topics: Mapped[list["Topic"]] = relationship("Topic", back_populates="keyword_ref")


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    source_name: Mapped[str] = mapped_column(String(100), default="Unknown")
    heat_score: Mapped[int] = mapped_column(Integer, default=5)
    _tags: Mapped[str] = mapped_column("tags", Text, default="[]")
    is_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    keyword_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("keywords.id"), nullable=True)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovered_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    keyword_ref: Mapped["Keyword | None"] = relationship("Keyword", back_populates="topics")

    @property
    def tags(self) -> list[str]:
        try:
            return json.loads(self._tags)
        except Exception:
            return []

    @tags.setter
    def tags(self, value: list[str]):
        self._tags = json.dumps(value, ensure_ascii=False)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
