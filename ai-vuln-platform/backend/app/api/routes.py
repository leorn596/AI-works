"""API routes."""
from __future__ import annotations
import logging
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.schemas import (
    ManualAnalysisRequest,
    BatchAnalysisRequest,
    MultiSourceAnalysisRequest,
    APIResponse,
)
from app.core.database import get_db
from fastapi.responses import StreamingResponse
from app.core.redis import cache_analysis_result, get_cached_analysis, invalidate_analysis_cache
from app.models.models import AnalysisTask, Vulnerability, RemediationChecklist
from app.services.ai_service import analyze_vulnerability, analyze_vulnerability_batch
from app.services.multi_source_service import analyze_multi_source

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", response_model=APIResponse, summary="健康检查", description="检查后端服务是否正常运行，返回服务状态。")
async def health_check():
    """健康检查端点。"""
    return APIResponse(code=200, message="ok", data={"status": "healthy"})


async def _save_analysis_result(
    db: AsyncSession,
    input_type: str,
    input_content: str,
    model_used: Optional[str],
    result: dict,
) -> int:
    """Save analysis result to MySQL. Returns task_id."""
    task = AnalysisTask(
        input_type=input_type,
        input_content=input_content,
        model_used=model_used,
        status="completed",
        summary=result.get("summary", ""),
        cvss_overall=result.get("cvss_overall"),
    )
    db.add(task)
    await db.flush()  # get task.id

    for vuln in result.get("vulnerabilities", []):
        db.add(
            Vulnerability(
                task_id=task.id,
                vuln_name=vuln.get("vuln_name", ""),
                vuln_type=vuln.get("vuln_type", "UNKNOWN"),
                cvss_vector=vuln.get("cvss_vector"),
                cvss_score=vuln.get("cvss_score"),
                description=vuln.get("description"),
                remediation=vuln.get("remediation"),
            )
        )

    # T5.5: Save checklist items
    for item in result.get("checklist", []):
        if isinstance(item, dict):
            title = item.get("title", "")
            detail = item.get("detail", "")
            priority = item.get("priority", 3)
            category = item.get("category", "配置")
            text = f"[P{priority}][{category}] {title}: {detail}" if title else detail
        elif isinstance(item, str):
            text = item
        else:
            continue
        if text.strip():
            db.add(
                RemediationChecklist(
                    task_id=task.id,
                    item_text=text.strip(),
                )
            )

    await db.commit()
    logger.info(
        "Saved analysis result: task_id=%d, vulns=%d, checklist=%d",
        task.id,
        len(result.get("vulnerabilities", [])),
        len(result.get("checklist", [])),
    )
    return task.id


@router.post("/analyze/manual", response_model=APIResponse, summary="手动漏洞分析", description="接受漏洞文本描述，调用 AI 模型分析，返回结构化结果。自动保存到 MySQL 并缓存到 Redis。")
async def analyze_manual(req: ManualAnalysisRequest, db: AsyncSession = Depends(get_db)):
    """手动漏洞分析端点。"""
    try:
        result = await analyze_vulnerability(
            description=req.description,
            model=req.model,
        )
        # Save to MySQL
        task_id = await _save_analysis_result(
            db=db,
            input_type="manual",
            input_content=req.description,
            model_used=req.model,
            result=result,
        )
        # Cache in Redis
        await cache_analysis_result(task_id, result)
        # Include task_id in response
        result["task_id"] = task_id
        return APIResponse(code=200, message="分析完成", data=result)
    except RuntimeError as e:
        logger.error("AI service error: %s", e)
        raise HTTPException(status_code=503, detail="AI 服务暂时不可用，请稍后重试")
    except Exception as e:
        logger.exception("Analysis failed: %s", e)
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.post("/analyze/batch", response_model=APIResponse, summary="批量漏洞分析", description="接受文件解析后的漏洞数组，逐个调用 AI 进行深度分析。自动保存到 MySQL 并缓存到 Redis。")
async def analyze_batch(req: BatchAnalysisRequest, db: AsyncSession = Depends(get_db)):
    """批量漏洞分析端点。"""
    try:
        vuln_dicts = [v.model_dump() for v in req.vulnerabilities]
        result = await analyze_vulnerability_batch(vuln_dicts)
        # Save to MySQL
        input_content = str(vuln_dicts)[:5000]  # truncate for storage
        task_id = await _save_analysis_result(
            db=db,
            input_type="file",
            input_content=input_content,
            model_used=None,
            result=result,
        )
        # Cache in Redis
        await cache_analysis_result(task_id, result)
        result["task_id"] = task_id
        return APIResponse(code=200, message="批量分析完成", data=result)
    except RuntimeError as e:
        logger.error("AI service error in batch: %s", e)
        raise HTTPException(status_code=503, detail="AI 服务暂时不可用，请稍后重试")
    except Exception as e:
        logger.exception("Batch analysis failed: %s", e)
        raise HTTPException(status_code=500, detail="服务器内部错误")


# ─── T5.1: Multi-source cross-validation endpoint ──────────────


@router.post("/analyze/multi-source", response_model=APIResponse, summary="多源交叉验证分析", description="接受 ZAP 和 Nmap 漏洞列表，执行 AI 驱动的交叉验证分析。结果保存到 MySQL 并缓存到 Redis。")
async def analyze_multi_source_endpoint(
    req: MultiSourceAnalysisRequest,
    db: AsyncSession = Depends(get_db),
):
    """多源交叉验证分析端点。"""
    try:
        zap_dicts = [v.model_dump() for v in req.zap_vulnerabilities]
        nmap_dicts = [v.model_dump() for v in req.nmap_vulnerabilities]

        result = await analyze_multi_source(zap_dicts, nmap_dicts)

        # Save to MySQL (input_type='multi')
        input_content = f"ZAP:{len(zap_dicts)} vulns, Nmap:{len(nmap_dicts)} vulns"
        task_id = await _save_analysis_result(
            db=db,
            input_type="multi",
            input_content=input_content,
            model_used=None,
            result=result,
        )
        # Cache in Redis
        await cache_analysis_result(task_id, result)
        result["task_id"] = task_id
        return APIResponse(code=200, message="多源对比分析完成", data=result)
    except RuntimeError as e:
        logger.error("AI multi-source error: %s", e)
        raise HTTPException(status_code=503, detail="AI 服务暂时不可用，请稍后重试")
    except Exception as e:
        logger.exception("Multi-source analysis failed: %s", e)
        raise HTTPException(status_code=500, detail="服务器内部错误")


# ─── History endpoints (T4.2) ──────────────────────────


@router.get("/history", response_model=APIResponse, summary="历史记录列表", description="分页查询历史分析记录，支持日期范围和漏洞类型筛选。返回分页数据。")
async def get_history(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    start_date: Optional[str] = Query(None, description="开始日期，格式 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式 YYYY-MM-DD"),
    vuln_type: Optional[str] = Query(None, description="漏洞类型过滤，如 SQLi/XSS/SSRF"),
    db: AsyncSession = Depends(get_db),
):
    """历史记录查询端点。"""
    # Build filters
    conditions = []
    if start_date:
        try:
            dt_start = datetime.strptime(start_date, "%Y-%m-%d")
            conditions.append(AnalysisTask.created_at >= dt_start)
        except ValueError:
            raise HTTPException(status_code=400, detail="start_date 格式错误，请使用 YYYY-MM-DD")
    if end_date:
        try:
            dt_end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            conditions.append(AnalysisTask.created_at <= dt_end)
        except ValueError:
            raise HTTPException(status_code=400, detail="end_date 格式错误，请使用 YYYY-MM-DD")

    if vuln_type:
        # Filter tasks that have vulnerabilities of the given type
        task_ids_subq = (
            select(Vulnerability.task_id)
            .where(Vulnerability.vuln_type == vuln_type)
            .distinct()
            .subquery()
        )
        conditions.append(AnalysisTask.id.in_(select(task_ids_subq.c.task_id)))

    where_clause = and_(*conditions) if conditions else True

    # Count total
    count_q = select(func.count(AnalysisTask.id)).where(where_clause)
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    # T5.0: Fetch page with vuln_count via subquery (N+1 optimization)
    vuln_count_subq = (
        select(
            Vulnerability.task_id,
            func.count(Vulnerability.id).label("vuln_count"),
        )
        .group_by(Vulnerability.task_id)
        .subquery()
    )

    offset = (page - 1) * page_size
    items_q = (
        select(
            AnalysisTask,
            func.coalesce(vuln_count_subq.c.vuln_count, 0).label("vuln_count"),
        )
        .outerjoin(vuln_count_subq, AnalysisTask.id == vuln_count_subq.c.task_id)
        .where(where_clause)
        .order_by(AnalysisTask.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    items_result = await db.execute(items_q)
    rows = items_result.all()

    # Build response
    items = []
    for t, vuln_count in rows:
        items.append({
            "id": t.id,
            "input_type": t.input_type,
            "model_used": t.model_used,
            "status": t.status,
            "summary": t.summary,
            "cvss_overall": t.cvss_overall,
            "vuln_count": vuln_count,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    return APIResponse(
        code=200,
        message="ok",
        data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    )


@router.get("/history/{task_id}", response_model=APIResponse, summary="历史记录详情", description="获取单个分析任务的完整详情，包含关联的漏洞列表和加固清单。优先从 Redis 缓存读取。")
async def get_history_detail(task_id: int, db: AsyncSession = Depends(get_db)):
    """历史记录详情端点。"""
    # Try Redis cache
    cached = await get_cached_analysis(task_id)
    if cached:
        # T6.0: Verify checklist field consistency — cache from analysis endpoint
        # has raw AI items without is_completed; DB has {id, item_text, is_completed}
        cached_checklist = cached.get("checklist", [])
        needs_rebuild = False
        if cached_checklist:
            first_item = cached_checklist[0]
            if isinstance(first_item, dict) and "item_text" not in first_item and "id" not in first_item:
                needs_rebuild = True
        if needs_rebuild:
            # Invalidate stale cache and fall through to DB query
            await invalidate_analysis_cache(task_id)
        else:
            return APIResponse(code=200, message="ok", data={"task_id": task_id, "from_cache": True, **cached})

    # Query DB with eager-loaded vulnerabilities
    q = (
        select(AnalysisTask)
        .where(AnalysisTask.id == task_id)
        .options(selectinload(AnalysisTask.vulnerabilities))
        .options(selectinload(AnalysisTask.remediation_items))
    )
    result = await db.execute(q)
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    vulns = [
        {
            "id": v.id,
            "vuln_name": v.vuln_name,
            "vuln_type": v.vuln_type,
            "cvss_vector": v.cvss_vector,
            "cvss_score": v.cvss_score,
            "description": v.description,
            "remediation": v.remediation,
        }
        for v in task.vulnerabilities
    ]

    # T5.5: Include checklist items
    checklist = [
        {
            "id": c.id,
            "item_text": c.item_text,
            "is_completed": bool(c.is_completed),
        }
        for c in task.remediation_items
    ]

    data = {
        "id": task.id,
        "input_type": task.input_type,
        "input_content": task.input_content,
        "model_used": task.model_used,
        "status": task.status,
        "summary": task.summary,
        "cvss_overall": task.cvss_overall,
        "error_message": task.error_message,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
        "vulnerabilities": vulns,
        "checklist": checklist,
    }

    # Cache for future lookups (include checklist for field consistency)
    await cache_analysis_result(task_id, data)

    return APIResponse(code=200, message="ok", data=data)


# ─── T6.2: PDF report generation endpoint ──────────────


@router.get("/report/{task_id}/pdf", summary="生成 PDF 报告", description="为已完成的分析任务生成 PDF 报告。summary 模式仅含概览，full 模式包含漏洞明细和加固清单。返回 PDF 文件流。")
async def get_report_pdf(
    task_id: int,
    mode: str = Query("full", regex="^(summary|full)$", description="报告模式: summary=摘要, full=完整报告"),
    db: AsyncSession = Depends(get_db),
):
    """PDF 报告生成端点。"""
    from app.services.pdf_service import generate_pdf_bytes

    # Fetch task data (reuse existing logic)
    q = (
        select(AnalysisTask)
        .where(AnalysisTask.id == task_id)
        .options(selectinload(AnalysisTask.vulnerabilities))
        .options(selectinload(AnalysisTask.remediation_items))
    )
    result = await db.execute(q)
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status != "completed":
        raise HTTPException(status_code=400, detail="任务尚未完成，无法生成报告")

    vulns = [
        {
            "vuln_name": v.vuln_name,
            "vuln_type": v.vuln_type,
            "cvss_vector": v.cvss_vector,
            "cvss_score": v.cvss_score,
            "description": v.description,
            "remediation": v.remediation,
        }
        for v in task.vulnerabilities
    ]

    checklist = [
        {"item_text": c.item_text, "is_completed": bool(c.is_completed)}
        for c in task.remediation_items
    ]

    report_data = {
        "input_type": task.input_type,
        "summary": task.summary,
        "cvss_overall": task.cvss_overall,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "vulnerabilities": vulns,
        "checklist": checklist,
    }

    try:
        pdf_bytes = await generate_pdf_bytes(task_id, report_data, mode=mode)
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="vuln_report_{task_id}_{mode}.pdf"'
            },
        )
    except RuntimeError as e:
        logger.error("PDF generation error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
