"""PDF report generation service using xhtml2pdf (no system deps)."""
from __future__ import annotations

import io
import logging
import os
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ── T7.0: Chinese font registration ──────────────────────────────────────────
# xhtml2pdf uses reportlab under the hood; register WenQuanYi Zen Hei.
_CJK_FONT_PATHS = [
    # Debian/Ubuntu: fonts-wqy-zenhei package (6MB, much lighter than noto-cjk)
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]

_CJK_FONTS_REGISTERED = False

def _ensure_cjk_fonts():
    """Register CJK fonts with reportlab so xhtml2pdf can render Chinese."""
    global _CJK_FONTS_REGISTERED
    if _CJK_FONTS_REGISTERED:
        return
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        for path in _CJK_FONT_PATHS:
            if not os.path.isfile(path):
                continue
            pdfmetrics.registerFont(TTFont('WenQuanYi', path, subfontIndex=0))
            pdfmetrics.registerFont(TTFont('WenQuanYi-Bold', path, subfontIndex=0))
            logger.info("Registered CJK font: WenQuanYi from %s", path)
            break
        _CJK_FONTS_REGISTERED = True
    except ImportError:
        logger.warning("reportlab not available; CJK font registration skipped")
    except Exception as e:
        logger.warning("CJK font registration failed (non-fatal): %s", e)

# Try to register at module load
_ensure_cjk_fonts()


def _severity_label(score: Optional[float]) -> str:
    """Convert CVSS score to Chinese severity label."""
    if score is None:
        return "未知"
    if score >= 9:
        return "严重"
    if score >= 7:
        return "高危"
    if score >= 4:
        return "中危"
    return "低危"


def _severity_color(score: Optional[float]) -> str:
    """Convert CVSS score to CSS color."""
    if score is None:
        return "#999"
    if score >= 9:
        return "#f5222d"
    if score >= 7:
        return "#fa8c16"
    if score >= 4:
        return "#fadb14"
    return "#52c41a"


def _render_vuln_rows(vulnerabilities: list[dict]) -> str:
    """Render vulnerability table rows as HTML."""
    rows = []
    for i, v in enumerate(vulnerabilities, 1):
        score = v.get("cvss_score")
        color = _severity_color(score)
        label = _severity_label(score)
        name = v.get("vuln_name", "未知")
        vtype = v.get("vuln_type", "未知")
        description = (v.get("description", "") or "")[:200]
        remediation = (v.get("remediation", "") or "")[:200]

        rows.append(f"""
        <tr>
            <td>{i}</td>
            <td class="vuln-name">{name}</td>
            <td><span class="tag tag-blue">{vtype}</span></td>
            <td><span class="severity-badge" style="background:{color}">{label} {score:.1f}</span></td>
            <td>{description}</td>
            <td>{remediation}</td>
        </tr>
        """)
    return "\n".join(rows)


def _render_checklist_section(checklist: list[dict]) -> str:
    """Render remediation checklist section as HTML."""
    if not checklist:
        return ""

    items_html = []
    for item in checklist:
        if isinstance(item, dict):
            text = item.get("item_text", "")
        else:
            text = str(item)
        if text.strip():
            items_html.append(f'<li>{text}</li>')

    if not items_html:
        return ""

    return f"""
    <div class="section">
        <h2>安全加固清单</h2>
        <ul class="checklist">
            {"".join(items_html)}
        </ul>
    </div>
    """


def generate_pdf_html(
    task_id: int,
    data: dict,
    mode: str = "full",
) -> str:
    """
    Generate HTML for PDF report.

    Args:
        task_id: Analysis task ID
        data: Task data dict with vulnerabilities, checklist, summary, etc.
        mode: 'summary' for overview only, 'full' for complete report

    Returns:
        HTML string ready for WeasyPrint rendering
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    summary = data.get("summary", "暂无总结")
    cvss_overall = data.get("cvss_overall")
    vuln_count = len(data.get("vulnerabilities", []))
    created_at = data.get("created_at", now)
    input_type = data.get("input_type", "manual")

    # Build vulnerability table (only in full mode)
    vuln_table = ""
    if mode == "full":
        vulns = data.get("vulnerabilities", [])
        if vulns:
            vuln_rows = _render_vuln_rows(vulns)
            vuln_table = f"""
            <div class="section">
                <h2>漏洞明细</h2>
                <table class="vuln-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>漏洞名称</th>
                            <th>类型</th>
                            <th>严重程度</th>
                            <th>描述</th>
                            <th>修复方案</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vuln_rows}
                    </tbody>
                </table>
            </div>
            """

    # Build checklist section (only in full mode)
    checklist_section = ""
    if mode == "full":
        checklist_section = _render_checklist_section(data.get("checklist", []))

    cvss_display = f"{cvss_overall:.1f}" if cvss_overall is not None else "N/A"
    cvss_label = _severity_label(cvss_overall)
    cvss_color = _severity_color(cvss_overall)

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
    @page {{
        size: A4;
        margin: 2cm 1.5cm;
    }}

    * {{
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }}

    body {{
        font-family: "WenQuanYi", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
        font-size: 11pt;
        color: #333;
        line-height: 1.6;
    }}

    .header {{
        text-align: center;
        border-bottom: 3px solid #1677ff;
        padding-bottom: 16px;
        margin-bottom: 24px;
    }}

    .header h1 {{
        font-size: 22pt;
        color: #1677ff;
        margin-bottom: 8px;
    }}

    .header .subtitle {{
        font-size: 10pt;
        color: #888;
    }}

    .overview-grid {{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 24px;
    }}

    .overview-card {{
        border: 1px solid #e8e8e8;
        border-radius: 8px;
        padding: 12px 16px;
    }}

    .overview-card .label {{
        font-size: 9pt;
        color: #888;
        margin-bottom: 4px;
    }}

    .overview-card .value {{
        font-size: 16pt;
        font-weight: bold;
        color: #1677ff;
    }}

    .section {{
        margin-bottom: 24px;
    }}

    .section h2 {{
        font-size: 14pt;
        color: #1677ff;
        border-left: 4px solid #1677ff;
        padding-left: 12px;
        margin-bottom: 12px;
    }}

    .summary-box {{
        background: #f6f8fa;
        border-radius: 8px;
        padding: 16px;
        font-size: 11pt;
        line-height: 1.8;
    }}

    .severity-badge {{
        display: inline-block;
        color: #fff;
        padding: 2px 10px;
        border-radius: 4px;
        font-size: 10pt;
        font-weight: bold;
    }}

    .tag {{
        display: inline-block;
        padding: 1px 8px;
        border-radius: 4px;
        font-size: 9pt;
    }}

    .tag-blue {{
        background: #e6f4ff;
        color: #1677ff;
        border: 1px solid #91caff;
    }}

    .vuln-table {{
        width: 100%;
        border-collapse: collapse;
        font-size: 9pt;
    }}

    .vuln-table th {{
        background: #1677ff;
        color: #fff;
        padding: 8px 6px;
        text-align: left;
        font-weight: 600;
    }}

    .vuln-table td {{
        padding: 8px 6px;
        border-bottom: 1px solid #e8e8e8;
        vertical-align: top;
    }}

    .vuln-table tr:nth-child(even) {{
        background: #fafafa;
    }}

    .vuln-name {{
        font-weight: bold;
    }}

    .checklist {{
        list-style: none;
        padding: 0;
    }}

    .checklist li {{
        padding: 8px 12px;
        border-left: 3px solid #1677ff;
        margin-bottom: 6px;
        background: #f9f9f9;
        border-radius: 0 4px 4px 0;
        font-size: 10pt;
    }}

    .footer {{
        margin-top: 40px;
        padding-top: 12px;
        border-top: 1px solid #e8e8e8;
        text-align: center;
        font-size: 9pt;
        color: #aaa;
    }}
</style>
</head>
<body>

<div class="header">
    <h1>🛡️ 漏洞分析报告</h1>
    <div class="subtitle">AI 漏洞分析平台 · 任务 #{task_id} · 生成时间 {now}</div>
</div>

<div class="overview-grid">
    <div class="overview-card">
        <div class="label">分析类型</div>
        <div class="value" style="font-size:14pt">{input_type}</div>
    </div>
    <div class="overview-card">
        <div class="label">漏洞总数</div>
        <div class="value">{vuln_count}</div>
    </div>
    <div class="overview-card">
        <div class="label">综合 CVSS</div>
        <div class="value"><span class="severity-badge" style="background:{cvss_color}">{cvss_label} {cvss_display}</span></div>
    </div>
    <div class="overview-card">
        <div class="label">分析时间</div>
        <div class="value" style="font-size:12pt">{created_at}</div>
    </div>
</div>

<div class="section">
    <h2>总体评估</h2>
    <div class="summary-box">{summary}</div>
</div>

{vuln_table}

{checklist_section}

<div class="footer">
    本报告由 AI 漏洞分析平台自动生成 · 仅供参考，请结合实际情况判断
</div>

</body>
</html>"""


async def generate_pdf_bytes(
    task_id: int,
    data: dict,
    mode: str = "full",
) -> bytes:
    """
    Generate PDF bytes for a given task.

    Args:
        task_id: Analysis task ID
        data: Task data dict
        mode: 'summary' or 'full'

    Returns:
        PDF file bytes
    """
    html_content = generate_pdf_html(task_id, data, mode)

    try:
        _ensure_cjk_fonts()  # ensure registration before each PDF generation
        from xhtml2pdf import pisa

        result = io.BytesIO()
        pisa_status = pisa.CreatePDF(html_content, dest=result, encoding='utf-8')
        pdf_bytes = result.getvalue()
        if pisa_status.err:
            logger.warning("xhtml2pdf had minor warnings for task %s", task_id)
        logger.info("Generated PDF for task %s (mode=%s, %d bytes)", task_id, mode, len(pdf_bytes))
        return pdf_bytes
    except ImportError:
        logger.error("xhtml2pdf is not installed. Install with: pip install xhtml2pdf")
        raise RuntimeError("PDF 生成服务不可用：缺少 xhtml2pdf 依赖")
    except Exception as e:
        logger.exception("PDF generation failed for task %s: %s", task_id, e)
        raise RuntimeError(f"PDF 生成失败: {e}")
