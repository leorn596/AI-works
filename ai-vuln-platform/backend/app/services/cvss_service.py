"""CVSS 3.1 scoring service with Redis caching."""
from __future__ import annotations

import hashlib
import json
import logging
import math
from typing import Optional

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# CVSS 3.1 metric weights
CVSS_AV = {"N": 0.85, "A": 0.62, "L": 0.55, "P": 0.20}
CVSS_AC = {"L": 0.77, "H": 0.44}
CVSS_PR_U = {"N": 0.85, "L": 0.62, "H": 0.27}
CVSS_PR_SC = {"N": 0.85, "L": 0.68, "H": 0.50}
CVSS_UI = {"N": 0.85, "R": 0.62}
CVSS_CIA = {"N": 0.00, "L": 0.22, "H": 0.56}


def _parse_cvss_vector(vector: str) -> dict:
    """Parse CVSS 3.1 vector string into a dict of metric -> value."""
    metrics = {}
    if not vector:
        return metrics
    # Strip prefix if present
    if "/" in vector:
        parts = vector.split("/")
        for part in parts:
            if ":" in part:
                key, val = part.split(":", 1)
                # Skip the CVSS:3.1 prefix token
                if key == "CVSS":
                    continue
                metrics[key] = val.upper()
    return metrics


def compute_cvss_score(vector: str) -> Optional[float]:
    """
    Compute CVSS 3.1 base score from vector string.
    Returns None if vector is invalid or incomplete.
    """
    m = _parse_cvss_vector(vector)
    required = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"]
    if not all(k in m for k in required):
        return None

    try:
        av = CVSS_AV.get(m["AV"])
        ac = CVSS_AC.get(m["AC"])
        ui = CVSS_UI.get(m["UI"])
        c = CVSS_CIA.get(m["C"])
        i_val = CVSS_CIA.get(m["I"])
        a = CVSS_CIA.get(m["A"])
        if any(v is None for v in [av, ac, ui, c, i_val, a]):
            return None

        # PR weight depends on Scope
        if m["S"] == "C":
            pr = CVSS_PR_SC.get(m["PR"])
        else:
            pr = CVSS_PR_U.get(m["PR"])
        if pr is None:
            return None

        # Impact Sub-Score (ISS)
        iss = 1.0 - ((1.0 - c) * (1.0 - i_val) * (1.0 - a))

        # Impact
        if m["S"] == "U":
            impact = 6.42 * iss
        else:
            impact = 7.52 * (iss - 0.029) - 3.25 * ((iss - 0.02) ** 15)

        # Exploitability
        exploitability = 8.22 * av * ac * pr * ui

        if impact <= 0:
            return 0.0

        if m["S"] == "U":
            base = min(impact + exploitability, 10.0)
            base = math.ceil(base * 10) / 10
        else:
            base = min(1.08 * (impact + exploitability), 10.0)
            base = math.ceil(base * 10) / 10

        return round(base, 1)
    except Exception as e:
        logger.warning("CVSS computation error for vector '%s': %s", vector, e)
        return None


def compute_cvss_sub_scores(vector: str) -> dict:
    """Compute CVSS 3.1 impact and exploitability sub-scores."""
    m = _parse_cvss_vector(vector)
    required = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"]
    if not all(k in m for k in required):
        return {"impact": None, "exploitability": None}

    try:
        av = CVSS_AV.get(m["AV"])
        ac = CVSS_AC.get(m["AC"])
        ui = CVSS_UI.get(m["UI"])
        c = CVSS_CIA.get(m["C"])
        i_val = CVSS_CIA.get(m["I"])
        a = CVSS_CIA.get(m["A"])
        if any(v is None for v in [av, ac, ui, c, i_val, a]):
            return {"impact": None, "exploitability": None}

        if m["S"] == "C":
            pr = CVSS_PR_SC.get(m["PR"])
        else:
            pr = CVSS_PR_U.get(m["PR"])
        if pr is None:
            return {"impact": None, "exploitability": None}

        iss = 1.0 - ((1.0 - c) * (1.0 - i_val) * (1.0 - a))
        if m["S"] == "U":
            impact = 6.42 * iss
        else:
            impact = 7.52 * (iss - 0.029) - 3.25 * ((iss - 0.02) ** 15)
        exploitability = 8.22 * av * ac * pr * ui

        return {
            "impact": round(impact, 1) if impact > 0 else 0.0,
            "exploitability": round(exploitability, 1),
        }
    except Exception:
        return {"impact": None, "exploitability": None}


def _feature_hash(vuln_name: str, vuln_type: str, description: str) -> str:
    """Generate a hash key for caching based on vulnerability features."""
    raw = f"{vuln_name}|{vuln_type}|{description}".strip()
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


async def get_cached_cvss(vuln_name: str, vuln_type: str, description: str) -> Optional[dict]:
    """Check Redis for cached CVSS data for this vulnerability."""
    try:
        r = await get_redis()
        h = _feature_hash(vuln_name, vuln_type, description)
        raw = await r.get(f"cvss:{h}")
        if raw:
            logger.info("CVSS cache HIT for %s", h)
            return json.loads(raw)
        return None
    except Exception as e:
        logger.warning("CVSS cache read failed: %s", e)
        return None


async def cache_cvss(vuln_name: str, vuln_type: str, description: str, data: dict, ttl: int = 86400):
    """Cache CVSS data with TTL (default 24h)."""
    try:
        r = await get_redis()
        h = _feature_hash(vuln_name, vuln_type, description)
        await r.set(f"cvss:{h}", json.dumps(data, ensure_ascii=False), ex=ttl)
        logger.info("Cached CVSS for %s (TTL=%ds)", h, ttl)
    except Exception as e:
        logger.warning("CVSS cache write failed: %s", e)


def validate_and_fix_cvss(vuln: dict) -> dict:
    """
    Validate AI-generated CVSS vector and fix score if inconsistent.
    Returns the vuln dict with corrected cvss_score and sub-scores.
    """
    vector = vuln.get("cvss_vector", "")
    if not vector:
        return vuln

    computed = compute_cvss_score(vector)
    if computed is None:
        return vuln

    # If AI score deviates > 0.5 from computed, override
    ai_score = vuln.get("cvss_score", 0)
    if ai_score and abs(ai_score - computed) <= 0.5:
        # Close enough, keep AI score but add sub-scores
        pass
    else:
        vuln["cvss_score"] = computed

    subs = compute_cvss_sub_scores(vector)
    vuln["cvss_impact_score"] = subs["impact"]
    vuln["cvss_exploitability_score"] = subs["exploitability"]

    return vuln
