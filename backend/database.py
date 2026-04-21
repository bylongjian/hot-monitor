from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from backend.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    """创建所有数据库表 + 增量迁移新列"""
    from backend import models  # noqa: F401 — import to register models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 增量迁移：给 keywords 表补充新列（如果不存在）
        await _migrate_keywords_columns(conn)
        await _migrate_indexes(conn)


async def _migrate_keywords_columns(conn):
    """为 keywords 表添加 type / platform / account_id 列（如果缺失）"""
    import sqlalchemy as sa

    result = await conn.execute(sa.text("PRAGMA table_info(keywords)"))
    existing_cols = {row[1] for row in result.fetchall()}

    if "type" not in existing_cols:
        await conn.execute(
            sa.text("ALTER TABLE keywords ADD COLUMN type VARCHAR(20) DEFAULT 'keyword'")
        )
    if "platform" not in existing_cols:
        await conn.execute(
            sa.text("ALTER TABLE keywords ADD COLUMN platform VARCHAR(50)")
        )
    if "account_id" not in existing_cols:
        await conn.execute(
            sa.text("ALTER TABLE keywords ADD COLUMN account_id VARCHAR(200)")
        )


async def _migrate_indexes(conn):
    """为热点与关键词表补充性能索引（如果缺失）"""
    import sqlalchemy as sa

    index_statements = [
        "CREATE INDEX IF NOT EXISTS idx_topics_source_url ON topics(source_url)",
        "CREATE INDEX IF NOT EXISTS idx_topics_discovered_at ON topics(discovered_at)",
        "CREATE INDEX IF NOT EXISTS idx_topics_keyword_id ON topics(keyword_id)",
        "CREATE INDEX IF NOT EXISTS idx_topics_heat_score ON topics(heat_score)",
        "CREATE INDEX IF NOT EXISTS idx_keywords_enabled ON keywords(enabled)",
        "CREATE INDEX IF NOT EXISTS idx_keywords_created_at ON keywords(created_at)",
    ]

    for statement in index_statements:
        await conn.execute(sa.text(statement))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
