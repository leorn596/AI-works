"""Redis async client — caching layer for analysis results."""
import json
import logging
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Default TTL: 1 hour
CACHE_TTL = 3600

redis_client: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    """Get or create the global async Redis client."""
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
        )
    return redis_client


async def close_redis():
    """Close Redis connection on shutdown."""
    global redis_client
    if redis_client is not None:
        await redis_client.close()
        redis_client = None


async def cache_analysis_result(task_id: int, data: dict, ttl: int = CACHE_TTL):
    """Cache analysis result for a given task_id."""
    try:
        r = await get_redis()
        key = f"analysis:{task_id}"
        await r.set(key, json.dumps(data, ensure_ascii=False), ex=ttl)
        logger.info("Cached analysis result for task %s (TTL=%ds)", task_id, ttl)
    except Exception as e:
        # Cache failure is non-critical; log and continue
        logger.warning("Redis cache write failed for task %s: %s", task_id, e)


async def get_cached_analysis(task_id: int) -> Optional[dict]:
    """Retrieve cached analysis result. Returns None on miss or error."""
    try:
        r = await get_redis()
        key = f"analysis:{task_id}"
        raw = await r.get(key)
        if raw:
            logger.info("Cache HIT for task %s", task_id)
            return json.loads(raw)
        logger.info("Cache MISS for task %s", task_id)
        return None
    except Exception as e:
        logger.warning("Redis cache read failed for task %s: %s", task_id, e)
        return None


async def invalidate_analysis_cache(task_id: int):
    """Delete cached result for a given task_id."""
    try:
        r = await get_redis()
        await r.delete(f"analysis:{task_id}")
    except Exception as e:
        logger.warning("Redis cache delete failed for task %s: %s", task_id, e)
