from contextlib import asynccontextmanager
from pathlib import Path
import logging
import sys
import asyncio

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.config import get_settings
from backend.services.scheduler import start_scheduler, stop_scheduler
from backend.routers import keywords, topics, settings as settings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Windows: 静默处理 ProactorEventLoop 的 ConnectionResetError
    if sys.platform == "win32":
        loop = asyncio.get_running_loop()
        _orig = loop.get_exception_handler()

        def _quiet_reset(l, ctx):
            exc = ctx.get("exception")
            if isinstance(exc, ConnectionResetError):
                return
            if _orig:
                _orig(l, ctx)
            else:
                l.default_exception_handler(ctx)

        loop.set_exception_handler(_quiet_reset)

    # 启动时
    logger.info("AI热点情报台 正在启动...")
    await init_db()
    cfg = get_settings()
    start_scheduler(scan_interval_minutes=cfg.DEFAULT_SCAN_INTERVAL)
    logger.info("AI热点情报台 启动完成 ✓")
    yield
    # 关闭时
    stop_scheduler()
    logger.info("AI热点情报台 已关闭")


app = FastAPI(
    title="AI热点情报台 API",
    description="AI热点情报台后端 API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS（开发时允许 Vite dev server）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(keywords.router)
app.include_router(topics.router)
app.include_router(settings_router.router)

# 托管前端静态文件（生产模式）
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        index = FRONTEND_DIST / "index.html"
        return FileResponse(str(index))
else:
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "message": "AI热点情报台 API running",
            "docs": "/api/docs",
            "note": "前端尚未构建，请运行 cd frontend && npm install && npm run build",
        }
