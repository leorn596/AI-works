"""FastAPI application entry point."""
import logging
import time
from contextlib import asynccontextmanager
from collections import defaultdict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.redis import close_redis
from app.api.routes import router

logger = logging.getLogger(__name__)


# ── Rate Limiter (in-memory, per-IP sliding window) ─────
class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter. Per-endpoint limits configured below."""
    LIMITS = {
        "/api/analyze/manual": (10, 60),    # 10 requests per 60 seconds
        "/api/analyze/batch": (5, 60),      # 5 requests per 60 seconds (AI cost)
    }

    def __init__(self, app):
        super().__init__(app)
        self._windows: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        limit_rule = self.LIMITS.get(path)
        if limit_rule:
            max_req, window_sec = limit_rule
            client_ip = request.client.host if request.client else "unknown"
            key = f"{client_ip}:{path}"
            now = time.time()
            cutoff = now - window_sec
            # Clean expired entries
            self._windows[key] = [t for t in self._windows[key] if t > cutoff]
            if len(self._windows[key]) >= max_req:
                return JSONResponse(
                    status_code=429,
                    content={"code": 429, "message": "请求过于频繁，请稍后重试", "data": None},
                    headers={"Retry-After": str(window_sec)},
                )
            self._windows[key].append(now)
        return await call_next(request)


# ── Request Body Size Limiter ───────────────────────────
class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    MAX_SIZE = 10 * 1024 * 1024  # 10MB

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.MAX_SIZE:
            return JSONResponse(
                status_code=413,
                content={"code": 413, "message": "请求体过大（最大 10MB）", "data": None},
            )
        return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("🚀 %s v%s starting up", settings.PROJECT_NAME, settings.VERSION)
    yield
    logger.info("🛑 %s shutting down", settings.PROJECT_NAME)
    await close_redis()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# ── Security Middleware (order matters: body → rate → CORS) ──
app.add_middleware(MaxBodySizeMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Routes ──────────────────────────────────────────────
app.include_router(router, prefix=settings.API_PREFIX)


# ── Global exception handler ────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务器内部错误", "data": None},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
