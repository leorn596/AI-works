"""AI-powered vulnerability analysis service."""
from __future__ import annotations
import json
import logging
import asyncio
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.cvss_service import (
    get_cached_cvss,
    cache_cvss,
    validate_and_fix_cvss,
)

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """你是一位资深Web安全专家。请分析以下漏洞描述，输出JSON格式结果。
必须包含以下字段（JSON数组），每个漏洞一个对象：
- vuln_name（漏洞名称）
- vuln_type（漏洞类型如SQLi/XSS/SSRF/RCE/LFI等）
- cvss_vector（CVSS 3.1向量字符串，如 AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H）
- cvss_score（0-10评分，浮点数）
- description（漏洞原理与影响范围）
- remediation（修复方案，具体可操作的步骤）

如果发现多个漏洞，请返回多个对象的数组。
同时提供一个 summary 字段说明总体评估。
cvss_overall 字段为所有漏洞中最高的 CVSS 评分。

请同时生成 checklist 安全加固清单，格式如下：
- checklist: 数组，每项包含 priority(1-5, 1最紧急), category(配置/代码/网络/权限), title(标题), detail(详细说明)

请只返回合法 JSON，不要包含 markdown 代码块标记或任何其他文字。

漏洞描述：
{description}"""

URL_ANALYSIS_PROMPT = """你是一位资深Web安全专家。请分析目标 URL 可能存在的安全漏洞。
你不需要实际扫描或访问该 URL，只需基于 URL 结构（域名、路径、参数、端口等）和常见 Web 安全知识进行推理分析。

目标 URL：{url}

请输出JSON格式结果，包含：
- vulnerabilities: 数组，每个漏洞对象包含:
  - vuln_name（漏洞名称）
  - vuln_type（漏洞类型如SQLi/XSS/SSRF/RCE/LFI/CSRF/XXE/Auth等）
  - cvss_vector（CVSS 3.1向量字符串）
  - cvss_score（0-10评分，浮点数）
  - description（漏洞原理与影响范围，说明为什么该URL可能受此漏洞影响）
  - remediation（修复方案）
- summary：总体安全风险评估摘要（包含对URL结构、暴露面、潜在攻击面的分析）
- cvss_overall：所有漏洞中最高CVSS评分
- checklist：安全加固清单数组，每项包含 priority(1-5, 1最紧急), category(配置/代码/网络/权限), title(标题), detail(详细说明)

分析维度应包括但不限于：
1. URL路径和参数暴露的攻击面（如REST API、查询参数）
2. 域名和子域名相关的风险
3. 端口和服务暴露（如非标准端口）
4. 常见Web框架/技术栈的已知漏洞
5. 认证和授权相关风险
6. HTTPS配置和传输安全

请只返回合法 JSON，不要包含 markdown 代码块标记或任何其他文字。"""


BATCH_ANALYSIS_PROMPT = """你是一位资深Web安全专家。以下是通过自动化扫描工具发现的漏洞信息，请进行深度分析和增强。

原始漏洞信息：
{vuln_json}

请对每个漏洞进行分析，输出JSON格式结果，包含一个 vulnerabilities 数组。
每个漏洞对象必须包含：
- vuln_name（漏洞名称，可优化原始名称）
- vuln_type（标准化漏洞类型：SQLi/XSS/SSRF/RCE/LFI/CSRF/XXE/Auth等）
- cvss_vector（精确 CVSS 3.1 向量字符串，如 AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H）
- cvss_score（0-10评分，浮点数）
- description（详细漏洞原理与影响范围，补充原始描述）
- remediation（具体可操作的修复方案）
- severity（critical/high/medium/low，基于CVSS评分）

同时提供：
- summary：总体安全评估摘要
- cvss_overall：所有漏洞中最高CVSS评分
- checklist：安全加固清单数组，每项包含 priority(1-5, 1最紧急), category(配置/代码/网络/权限), title(标题), detail(详细说明)

请只返回合法 JSON，不要包含 markdown 代码块标记或任何其他文字。"""


async def analyze_vulnerability(description: str, model: str | None = None) -> dict:
    """
    Call OpenAI-compatible API to analyze a vulnerability description.
    Returns structured dict with vulnerabilities, summary, cvss_overall, checklist.
    """
    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
    )

    use_model = model or settings.OPENAI_MODEL
    prompt = ANALYSIS_PROMPT.format(description=description)

    logger.info("Calling AI model: %s", use_model)

    try:
        response = await client.chat.completions.create(
            model=use_model,
            messages=[
                {"role": "system", "content": "你是一位专业的Web安全分析师，只输出JSON格式结果。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
            timeout=30,
        )
    except Exception as e:
        err_str = str(e).lower()
        if "timeout" in err_str or "timed out" in err_str:
            raise RuntimeError("AI 服务响应超时（30s），请稍后重试") from e
        raise RuntimeError(f"AI 服务调用失败: {str(e)}") from e

    raw_content = response.choices[0].message.content.strip()
    logger.info("AI raw response length: %d", len(raw_content))

    result = _parse_ai_response(raw_content)

    # T5.3/T5.4: Validate CVSS vectors and apply caching
    for vuln in result.get("vulnerabilities", []):
        cached = await get_cached_cvss(
            vuln.get("vuln_name", ""),
            vuln.get("vuln_type", ""),
            vuln.get("description", ""),
        )
        if cached:
            vuln["cvss_vector"] = cached.get("cvss_vector", vuln.get("cvss_vector"))
            vuln["cvss_score"] = cached.get("cvss_score", vuln.get("cvss_score"))
            vuln["cvss_impact_score"] = cached.get("cvss_impact_score")
            vuln["cvss_exploitability_score"] = cached.get("cvss_exploitability_score")
        else:
            validate_and_fix_cvss(vuln)
            await cache_cvss(
                vuln.get("vuln_name", ""),
                vuln.get("vuln_type", ""),
                vuln.get("description", ""),
                {
                    "cvss_vector": vuln.get("cvss_vector"),
                    "cvss_score": vuln.get("cvss_score"),
                    "cvss_impact_score": vuln.get("cvss_impact_score"),
                    "cvss_exploitability_score": vuln.get("cvss_exploitability_score"),
                },
            )

    return result


async def analyze_url(url: str, model: str | None = None) -> dict:
    """
    Analyze a target URL for potential security vulnerabilities using AI reasoning.
    Does NOT perform actual scanning; uses AI knowledge base to infer risks.
    Returns structured dict with vulnerabilities, summary, cvss_overall, checklist.
    """
    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
    )

    use_model = model or settings.OPENAI_MODEL
    prompt = URL_ANALYSIS_PROMPT.format(url=url)

    logger.info("Analyzing URL: %s with model: %s", url, use_model)

    try:
        response = await client.chat.completions.create(
            model=use_model,
            messages=[
                {"role": "system", "content": "你是一位专业的Web安全分析师，只输出JSON格式结果。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
            timeout=30,
        )
    except Exception as e:
        err_str = str(e).lower()
        if "timeout" in err_str or "timed out" in err_str:
            raise RuntimeError("AI 服务响应超时（30s），请稍后重试") from e
        raise RuntimeError(f"AI 服务调用失败: {str(e)}") from e

    raw_content = response.choices[0].message.content.strip()
    logger.info("URL analysis AI response length: %d", len(raw_content))

    result = _parse_ai_response(raw_content)

    # Validate CVSS vectors and apply caching
    for vuln in result.get("vulnerabilities", []):
        cached = await get_cached_cvss(
            vuln.get("vuln_name", ""),
            vuln.get("vuln_type", ""),
            vuln.get("description", ""),
        )
        if cached:
            vuln["cvss_vector"] = cached.get("cvss_vector", vuln.get("cvss_vector"))
            vuln["cvss_score"] = cached.get("cvss_score", vuln.get("cvss_score"))
            vuln["cvss_impact_score"] = cached.get("cvss_impact_score")
            vuln["cvss_exploitability_score"] = cached.get("cvss_exploitability_score")
        else:
            validate_and_fix_cvss(vuln)
            await cache_cvss(
                vuln.get("vuln_name", ""),
                vuln.get("vuln_type", ""),
                vuln.get("description", ""),
                {
                    "cvss_vector": vuln.get("cvss_vector"),
                    "cvss_score": vuln.get("cvss_score"),
                    "cvss_impact_score": vuln.get("cvss_impact_score"),
                    "cvss_exploitability_score": vuln.get("cvss_exploitability_score"),
                },
            )

    return result


async def analyze_vulnerability_batch(vulnerabilities: list[dict], model: str | None = None) -> dict:
    """
    Batch analyze file-parsed vulnerabilities with AI enhancement.
    Processes vulnerabilities in parallel with concurrency limit.
    Returns structured dict with enhanced vulnerabilities, summary, cvss_overall, checklist.
    """
    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
    )

    use_model = model or settings.OPENAI_MODEL

    # Process in batches of 5 to avoid overwhelming the API
    batch_size = 5
    all_vulns = []
    all_checklists = []
    summaries = []

    for i in range(0, len(vulnerabilities), batch_size):
        batch = vulnerabilities[i:i + batch_size]
        prompt = BATCH_ANALYSIS_PROMPT.format(
            vuln_json=json.dumps(batch, ensure_ascii=False, indent=2)
        )

        logger.info("Batch analyzing %d vulnerabilities (batch %d)", len(batch), i // batch_size + 1)

        try:
            response = await client.chat.completions.create(
                model=use_model,
                messages=[
                    {"role": "system", "content": "你是一位专业的Web安全分析师，只输出JSON格式结果。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=4096,
                timeout=60,
            )
        except Exception as e:
            err_str = str(e).lower()
            if "timeout" in err_str or "timed out" in err_str:
                raise RuntimeError("AI 批量分析响应超时，请稍后重试或减少漏洞数量") from e
            raise RuntimeError(f"AI 批量分析调用失败: {str(e)}") from e

        raw_content = response.choices[0].message.content.strip()
        parsed = _parse_ai_response(raw_content)
        all_vulns.extend(parsed.get("vulnerabilities", []))
        all_checklists.extend(parsed.get("checklist", []))
        if parsed.get("summary"):
            summaries.append(parsed["summary"])

    # Combine summaries
    combined_summary = " | ".join(summaries) if summaries else ""
    cvss_overall = max((v.get("cvss_score", 0) for v in all_vulns), default=0)

    # T5.3/T5.4: Validate CVSS for batch results
    for vuln in all_vulns:
        cached = await get_cached_cvss(
            vuln.get("vuln_name", ""),
            vuln.get("vuln_type", ""),
            vuln.get("description", ""),
        )
        if cached:
            vuln["cvss_vector"] = cached.get("cvss_vector", vuln.get("cvss_vector"))
            vuln["cvss_score"] = cached.get("cvss_score", vuln.get("cvss_score"))
            vuln["cvss_impact_score"] = cached.get("cvss_impact_score")
            vuln["cvss_exploitability_score"] = cached.get("cvss_exploitability_score")
        else:
            validate_and_fix_cvss(vuln)
            await cache_cvss(
                vuln.get("vuln_name", ""),
                vuln.get("vuln_type", ""),
                vuln.get("description", ""),
                {
                    "cvss_vector": vuln.get("cvss_vector"),
                    "cvss_score": vuln.get("cvss_score"),
                    "cvss_impact_score": vuln.get("cvss_impact_score"),
                    "cvss_exploitability_score": vuln.get("cvss_exploitability_score"),
                },
            )

    return {
        "vulnerabilities": all_vulns,
        "summary": combined_summary,
        "cvss_overall": float(cvss_overall) if cvss_overall else None,
        "checklist": all_checklists,
    }


def _parse_ai_response(raw_content: str) -> dict:
    """Parse AI response JSON and normalize fields."""
    # Strip markdown code fences if present
    if raw_content.startswith("```"):
        lines = raw_content.split("\n")
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        raw_content = "\n".join(lines)

    try:
        result = json.loads(raw_content)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI response as JSON: %s", e)
        return {
            "vulnerabilities": [
                {
                    "vuln_name": "分析结果解析异常",
                    "vuln_type": "UNKNOWN",
                    "cvss_vector": "",
                    "cvss_score": 0.0,
                    "description": raw_content[:2000],
                    "remediation": "请人工审查原始分析结果",
                }
            ],
            "summary": f"AI 响应解析失败: {str(e)}",
            "cvss_overall": 0.0,
            "checklist": [],
        }

    # Normalize: ensure it's a dict with expected keys
    if isinstance(result, list):
        vulns = result
        summary = ""
        cvss_max = max((v.get("cvss_score", 0) for v in vulns), default=0)
        checklist = []
    else:
        vulns = result.get("vulnerabilities", result.get("vulns", [result]))
        summary = result.get("summary", "")
        cvss_max = result.get("cvss_overall", 0)
        checklist = result.get("checklist", [])
        if not cvss_max and vulns:
            cvss_max = max((v.get("cvss_score", 0) for v in vulns), default=0)

    # Ensure each vuln has required fields
    normalized = []
    for v in vulns:
        normalized.append(
            {
                "vuln_name": v.get("vuln_name", "未知漏洞"),
                "vuln_type": v.get("vuln_type", "UNKNOWN"),
                "cvss_vector": v.get("cvss_vector", ""),
                "cvss_score": float(v.get("cvss_score", 0)),
                "cvss_impact_score": v.get("cvss_impact_score"),
                "cvss_exploitability_score": v.get("cvss_exploitability_score"),
                "description": v.get("description", ""),
                "remediation": v.get("remediation", ""),
            }
        )

    # Normalize checklist items
    normalized_checklist = []
    for item in checklist:
        if isinstance(item, dict):
            normalized_checklist.append({
                "priority": int(item.get("priority", 3)),
                "category": item.get("category", "配置"),
                "title": item.get("title", ""),
                "detail": item.get("detail", ""),
            })

    return {
        "vulnerabilities": normalized,
        "summary": summary,
        "cvss_overall": float(cvss_max) if cvss_max else None,
        "checklist": normalized_checklist,
    }
