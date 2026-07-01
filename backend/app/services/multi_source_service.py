"""Multi-source cross-validation analysis service."""
from __future__ import annotations

import json
import logging
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

MULTI_SOURCE_PROMPT = """你是一位资深Web安全专家。请对以下两组漏洞扫描结果进行交叉对比分析。

## ZAP 扫描结果:
{zap_json}

## Nmap 扫描结果:
{nmap_json}

请执行以下分析并输出 JSON：

1. **cross_validation** 对象，包含四个数组：
   - `matched`: 双方都发现的漏洞，每项包含 `zap_vuln`(ZAP原始), `nmap_vuln`(Nmap原始), `confidence`(0-1匹配置信度), `match_reason`(匹配依据：名称相似/CVE编号/端口+服务)
   - `zap_only`: ZAP独有漏洞列表
   - `nmap_only`: Nmap独有漏洞列表  
   - `conflict`: 双方报告但存在冲突的项（如不同严重度），每项结构同 matched

2. 匹配规则优先级：CVE编号完全匹配 > 名称相似度 > 端口+服务名组合

3. **summary**: 整体安全态势总结

4. **cvss_overall**: 所有漏洞中最高 CVSS 评分

请只返回合法 JSON，不要包含 markdown 代码块标记或任何其他文字。
JSON 结构：
{{
  "cross_validation": {{
    "matched": [...],
    "zap_only": [...],
    "nmap_only": [...],
    "conflict": [...]
  }},
  "summary": "...",
  "cvss_overall": 0.0
}}"""


async def analyze_multi_source(
    zap_vulns: list[dict],
    nmap_vulns: list[dict],
    model: str | None = None,
) -> dict:
    """
    Cross-validate vulnerabilities from ZAP and Nmap using AI.
    Returns structured dict with cross_validation, summary, cvss_overall.
    """
    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
    )
    use_model = model or settings.OPENAI_MODEL

    prompt = MULTI_SOURCE_PROMPT.format(
        zap_json=json.dumps(zap_vulns, ensure_ascii=False, indent=2),
        nmap_json=json.dumps(nmap_vulns, ensure_ascii=False, indent=2),
    )

    logger.info("Calling AI model for multi-source analysis: %s", use_model)

    try:
        response = await client.chat.completions.create(
            model=use_model,
            messages=[
                {"role": "system", "content": "你是一位专业的Web安全分析师，擅长多源漏洞数据交叉验证。只输出JSON格式结果。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=8192,
            timeout=60,
        )
    except Exception as e:
        err_str = str(e).lower()
        if "timeout" in err_str or "timed out" in err_str:
            raise RuntimeError("AI 多源分析响应超时（60s），请稍后重试") from e
        raise RuntimeError(f"AI 多源分析调用失败: {str(e)}") from e

    raw_content = response.choices[0].message.content.strip()
    logger.info("Multi-source AI raw response length: %d", len(raw_content))

    return _parse_multi_source_response(raw_content)


def _parse_multi_source_response(raw_content: str) -> dict:
    """Parse multi-source AI response and normalize fields."""
    # Strip markdown fences
    if raw_content.startswith("```"):
        lines = raw_content.split("\n")
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        raw_content = "\n".join(lines)

    try:
        result = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse multi-source AI response: %s", e)
        return {
            "cross_validation": {
                "matched": [],
                "zap_only": [],
                "nmap_only": [],
                "conflict": [],
            },
            "summary": f"AI 响应解析失败: {str(e)}",
            "cvss_overall": 0.0,
        }

    # Normalize
    cv = result.get("cross_validation", {})
    return {
        "cross_validation": {
            "matched": cv.get("matched", []),
            "zap_only": cv.get("zap_only", []),
            "nmap_only": cv.get("nmap_only", []),
            "conflict": cv.get("conflict", []),
        },
        "summary": result.get("summary", ""),
        "cvss_overall": float(result.get("cvss_overall", 0)),
    }
