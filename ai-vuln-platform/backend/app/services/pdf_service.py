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
    # Debian/Ubuntu: fonts-noto-cjk package
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    # CentOS/RHEL: google-noto-cjk-fonts package
    "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc",
    # CentOS/RHEL: alternative weight
    "/usr/share/fonts/google-noto-cjk/NotoSansCJK-Medium.ttc",
    "/usr/share/fonts/google-noto-cjk/NotoSansCJK-DemiLight.ttc",
    # DroidSans (alternative)
    "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
]

# Auto-discover any CJK TTF/TTC fonts under common directories
_FONT_SCAN_DIRS = [
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    os.path.expanduser("~/.fonts"),
    os.path.expanduser("~/.local/share/fonts"),
]

_CJK_FONTS_REGISTERED = False

# CID font name to use in CSS font-family (fallback when no TrueType CJK font available)
_CJK_CID_FONT = None


def _ensure_cjk_fonts():
    """Register CJK fonts with reportlab so xhtml2pdf can render Chinese.

    Tries, in order:
    1. TrueType CJK fonts from known paths (wqy-zenhei, Noto, Droid)
    2. Glob scan for any CJK TTF/TTC/OTF font files
    3. reportlab built-in UnicodeCIDFont (STSong-Light) — zero-dependency CJK fallback
    """
    global _CJK_FONTS_REGISTERED, _CJK_CID_FONT
    _CJK_CID_FONT = None
    if _CJK_FONTS_REGISTERED:
        return
    try:
        from reportlab.pdfbase import pdfmetrics

        # ── Phase 1: TrueType CJK fonts ──
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.lib.fonts import addMapping

        # First try known paths
        for path in _CJK_FONT_PATHS:
            if not os.path.isfile(path):
                continue
            try:
                pdfmetrics.registerFont(TTFont('WenQuanYi', path, subfontIndex=0))
                pdfmetrics.registerFont(TTFont('WenQuanYi-Bold', path, subfontIndex=0))
                # Register with xhtml2pdf's font resolution system via addMapping
                addMapping('WenQuanYi', 0, 0, 'WenQuanYi')
                addMapping('WenQuanYi', 1, 0, 'WenQuanYi-Bold')
                addMapping('WenQuanYi', 0, 1, 'WenQuanYi')
                addMapping('WenQuanYi', 1, 1, 'WenQuanYi-Bold')
                logger.info("Registered CJK font: WenQuanYi from %s", path)
                _CJK_FONTS_REGISTERED = True
                return
            except Exception:
                continue

        # Phase 2: Glob scan for CJK font files
        import glob as _glob
        for scan_dir in _FONT_SCAN_DIRS:
            if not os.path.isdir(scan_dir):
                continue
            for pattern in ['**/*CJK*', '**/*chinese*', '**/*Noto*', '**/*wqy*', '**/*wqy-zenhei*', '**/*Droid*Fallback*']:
                for font_path in _glob.glob(os.path.join(scan_dir, pattern), recursive=True):
                    if not os.path.isfile(font_path):
                        continue
                    if not font_path.lower().endswith(('.ttf', '.ttc', '.otf')):
                        continue
                    try:
                        pdfmetrics.registerFont(TTFont('WenQuanYi', font_path, subfontIndex=0))
                        pdfmetrics.registerFont(TTFont('WenQuanYi-Bold', font_path, subfontIndex=0))
                        addMapping('WenQuanYi', 0, 0, 'WenQuanYi')
                        addMapping('WenQuanYi', 1, 0, 'WenQuanYi-Bold')
                        addMapping('WenQuanYi', 0, 1, 'WenQuanYi')
                        addMapping('WenQuanYi', 1, 1, 'WenQuanYi-Bold')
                        logger.info("Registered CJK font: WenQuanYi from scanned %s", font_path)
                        _CJK_FONTS_REGISTERED = True
                        return
                    except Exception:
                        continue

        # ── Phase 3: Fallback to reportlab built-in CID font ──
        # UnicodeCIDFont is built into reportlab, supports CJK with NO external fonts
        logger.info("No TrueType CJK font found; trying reportlab built-in CID font")
        try:
            from reportlab.pdfbase.cidfonts import UnicodeCIDFont
            cid_font = UnicodeCIDFont('STSong-Light')
            pdfmetrics.registerFont(cid_font)
            addMapping('STSong-Light', 0, 0, 'STSong-Light')
            addMapping('STSong-Light', 1, 0, 'STSong-Light')
            _CJK_CID_FONT = 'STSong-Light'
            logger.info("Registered CJK fallback: reportlab UniCodeCIDFont STSong-Light")
            _CJK_FONTS_REGISTERED = True
            return
        except ImportError:
            logger.warning("reportlab CID fonts not available (older version?)")
        except Exception as e:
            logger.warning("CID font registration failed: %s", e)

        # If we get here, NO CJK support is available
        logger.warning(
            "No CJK font found on system. PDF Chinese chars will render as boxes. "
            "Install: Debian/Ubuntu: 'fonts-wqy-zenhei' or 'fonts-noto-cjk'; "
            "CentOS/RHEL: 'google-noto-cjk-fonts'"
        )
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


def _html_escape(text: str) -> str:
    """Escape HTML special characters."""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
    )


def _text_to_html(text: str) -> str:
    """Convert plain text to HTML with line breaks for overflow prevention.

    - Replaces newlines with <br/>
    - Breaks long unbroken segments based on VISUAL width:
      CJK chars count as 2 units, ASCII chars as 1 unit.
      Max ~70 units per line (~35 CJK or ~70 ASCII).
    """
    text = (text or "")[:300]
    escaped = _html_escape(text)
    # Split by original newlines
    lines = escaped.split("\n")
    result_lines = []
    for line in lines:
        if not line:
            result_lines.append("")
            continue
        # Break long segments based on visual width
        # A segment is a run of non-whitespace chars
        segments = []
        buf = ""
        for ch in line:
            if ch in " \t\u00a0":
                if buf:
                    segments.append(buf)
                    buf = ""
                segments.append(ch)
            else:
                buf += ch
        if buf:
            segments.append(buf)

        # Break segments whose visual width > 60
        def _visual_width(s: str) -> int:
            """Estimate visual width: CJK=2, ASCII=1."""
            w = 0
            for c in s:
                w += 2 if ord(c) > 127 else 1
            return w

        broken = []
        for seg in segments:
            vw = _visual_width(seg)
            if vw <= 60:
                broken.append(seg)
                continue
            # Break at 60 visual-width units
            chunk = ""
            cw = 0
            for c in seg:
                chw = 2 if ord(c) > 127 else 1
                if cw + chw > 60 and chunk:
                    broken.append(chunk)
                    broken.append("<br/>")
                    chunk = ""
                    cw = 0
                chunk += c
                cw += chw
            if chunk:
                broken.append(chunk)

        result_lines.append("".join(broken))

    return "<br/>".join(result_lines)


def _render_vuln_sections(vulnerabilities: list[dict]) -> str:
    """Render vulnerability info as 3 separate tables: overview, description, remediation."""
    overview_rows = []
    desc_rows = []
    fix_rows = []

    for i, v in enumerate(vulnerabilities, 1):
        score = v.get("cvss_score")
        color = _severity_color(score)
        label = _severity_label(score)
        name = v.get("vuln_name", "未知")
        name_html = _html_escape(name)
        vtype = v.get("vuln_type", "未知")
        description = _text_to_html(v.get("description", ""))
        remediation = _text_to_html(v.get("remediation", ""))
        score_display = f"{label} {score:.1f}" if score is not None else "未知"

        overview_rows.append(f"""
        <tr>
            <td>{i}</td>
            <td colspan="3">{name_html}</td>
            <td colspan="2"><span class="tag tag-blue">{vtype}</span></td>
            <td colspan="2"><span class="severity-badge" style="background:{color}">{score_display}</span></td>
        </tr>""")

        desc_rows.append(f"""
        <tr>
            <td>{i}</td>
            <td colspan="2">{name_html}</td>
            <td colspan="5">{description}</td>
        </tr>""")

        fix_rows.append(f"""
        <tr>
            <td>{i}</td>
            <td colspan="2">{name_html}</td>
            <td colspan="5">{remediation}</td>
        </tr>""")

    parts = []

    if overview_rows:
        parts.append(f"""<div class="section">
    <h2>漏洞概况</h2>
    <table class="vuln-table" style="width:510pt;table-layout:fixed;">
        <thead>
            <tr><th style="width:63pt">#</th><th colspan="3" style="width:192pt">漏洞名称</th><th colspan="2" style="width:127pt">类型</th><th colspan="2" style="width:128pt">严重程度</th></tr>
        </thead>
        <tbody>
            {"".join(overview_rows)}
        </tbody>
    </table>
</div>""")

    if desc_rows:
        parts.append(f"""<div class="section">
    <h2>漏洞描述</h2>
    <table class="vuln-table" style="width:510pt;table-layout:fixed;">
        <thead>
            <tr><th style="width:63pt">#</th><th colspan="2" style="width:128pt">漏洞名称</th><th colspan="5" style="width:319pt">描述</th></tr>
        </thead>
        <tbody>
            {"".join(desc_rows)}
        </tbody>
    </table>
</div>""")

    if fix_rows:
        parts.append(f"""<div class="section">
    <h2>修复方案</h2>
    <table class="vuln-table" style="width:510pt;table-layout:fixed;">
        <thead>
            <tr><th style="width:63pt">#</th><th colspan="2" style="width:128pt">漏洞名称</th><th colspan="5" style="width:319pt">修复方案</th></tr>
        </thead>
        <tbody>
            {"".join(fix_rows)}
        </tbody>
    </table>
</div>""")

    return "\n".join(parts)


def _render_checklist_section(checklist: list[dict]) -> str:
    """Render remediation checklist section as HTML."""
    if not checklist:
        return ""

    items_html = []
    for item in checklist:
        if isinstance(item, dict):
            # Structured item: {title, detail, priority, category}
            title = item.get("title", "")
            if title:
                priority = item.get("priority", 3)
                category = item.get("category", "配置")
                detail = item.get("detail", "")
                text = f"[P{priority}][{category}] {title}"
                if detail:
                    text += f": {detail}"
            else:
                # Fallback to item_text (legacy format)
                text = item.get("item_text", "")
            if text.strip():
                items_html.append(f'<li>{_text_to_html(text)}</li>')
        elif isinstance(item, str) and item.strip():
            items_html.append(f'<li>{item}</li>')

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
    summary = _text_to_html(data.get("summary", "暂无总结"))
    cvss_overall = data.get("cvss_overall")
    vuln_count = len(data.get("vulnerabilities", []))
    created_at = data.get("created_at", now)
    input_type = data.get("input_type", "manual")

    # Build vulnerability tables (only in full mode)
    vuln_tables = ""
    if mode == "full":
        vulns = data.get("vulnerabilities", [])
        if vulns:
            vuln_tables = _render_vuln_sections(vulns)

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

    @font-face {{
        font-family: "CJKFont";
        src: url("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc");
    }}

    * {{
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }}

    body {{
        font-family: "CJKFont", "WenQuanYi", "STSong-Light", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
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
        table-layout: fixed;
    }}

    .vuln-table {{
        width: 100%;
        border-collapse: collapse;
        font-size: 9pt;
        table-layout: fixed;
    }}



    .vuln-table th {{
        background: #1677ff;
        color: #fff;
        padding: 6px 6pt;
        text-align: left;
        font-weight: 600;
    }}

    .vuln-table td {{
        padding: 5px 6pt;
        border-bottom: 1px solid #e8e8e8;
        vertical-align: top;
    }}

    .vuln-table tr:nth-child(even) {{
        background: #fafafa;
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

{vuln_tables}

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
