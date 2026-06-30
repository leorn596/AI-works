"""Pydantic schemas for API request/response."""
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class ManualAnalysisRequest(BaseModel):
    """Request body for manual vulnerability analysis."""
    description: str = Field(..., min_length=10, max_length=10000, description="漏洞描述")
    model: Optional[str] = Field(None, description="AI model override")


class URLAnalysisRequest(BaseModel):
    """Request body for URL vulnerability analysis."""
    url: str = Field(..., min_length=10, max_length=2048, description="目标 URL (http/https)")

    @field_validator('url')
    @classmethod
    def validate_url_scheme(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL 必须以 http:// 或 https:// 开头')
        return v


class SourceVulnInput(BaseModel):
    """Single vulnerability from any external source."""
    vuln_name: str
    vuln_type: str = "UNKNOWN"
    severity: Optional[str] = None
    description: Optional[str] = None
    remediation: Optional[str] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    port: Optional[int] = None
    service: Optional[str] = None
    cve_id: Optional[str] = None
    host: Optional[str] = None


class MultiSourceAnalysisRequest(BaseModel):
    """Request body for multi-source cross-validation analysis."""
    zap_vulnerabilities: list[SourceVulnInput] = Field(
        ..., min_length=1, max_length=200, description="ZAP 扫描结果"
    )
    nmap_vulnerabilities: list[SourceVulnInput] = Field(
        ..., min_length=1, max_length=200, description="Nmap 扫描结果"
    )


class CrossValidationItem(BaseModel):
    """Single cross-validation entry."""
    zap_vuln: Optional[dict] = None
    nmap_vuln: Optional[dict] = None
    confidence: float = Field(0.0, ge=0, le=1, description="匹配置信度 0-1")
    match_reason: str = ""


class CrossValidationResult(BaseModel):
    """Cross-validation output."""
    matched: list[CrossValidationItem] = []
    zap_only: list[dict] = []
    nmap_only: list[dict] = []
    conflict: list[CrossValidationItem] = []


class ChecklistItem(BaseModel):
    """Single remediation checklist item."""
    priority: int = Field(3, ge=1, le=5, description="优先级 1-5")
    category: str = Field("配置", description="类别: 配置/代码/网络/权限")
    title: str = ""
    detail: str = ""


class FileVulnInput(BaseModel):
    """Single vulnerability from file parsing."""
    vuln_name: str
    vuln_type: str = "UNKNOWN"
    severity: Optional[str] = None
    description: Optional[str] = None
    remediation: Optional[str] = None
    cvss_score: Optional[float] = None


class BatchAnalysisRequest(BaseModel):
    """Request body for batch vulnerability analysis."""
    vulnerabilities: list[FileVulnInput] = Field(..., min_length=1, max_length=50)


class VulnerabilityOut(BaseModel):
    """Single vulnerability output."""
    vuln_name: str
    vuln_type: str
    cvss_vector: Optional[str] = None
    cvss_score: Optional[float] = None
    description: Optional[str] = None
    remediation: Optional[str] = None


class AnalysisResult(BaseModel):
    """Analysis result data."""
    vulnerabilities: list[VulnerabilityOut] = []
    summary: str = ""
    cvss_overall: Optional[float] = None


class APIResponse(BaseModel):
    """Unified API response format."""
    code: int = 200
    message: str = "success"
    data: Optional[dict] = None


class HistoryQueryParams(BaseModel):
    """Query parameters for history listing."""
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页条数")
    start_date: Optional[str] = Field(None, description="开始日期 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="结束日期 YYYY-MM-DD")
    vuln_type: Optional[str] = Field(None, description="漏洞类型过滤")


class TaskHistoryItem(BaseModel):
    """Single task in history list."""
    id: int
    input_type: str
    model_used: Optional[str] = None
    status: str
    summary: Optional[str] = None
    cvss_overall: Optional[float] = None
    vuln_count: int = 0
    created_at: Optional[str] = None


class TaskDetail(BaseModel):
    """Task detail with vulnerabilities."""
    id: int
    input_type: str
    input_content: str
    model_used: Optional[str] = None
    status: str
    summary: Optional[str] = None
    cvss_overall: Optional[float] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    vulnerabilities: list[dict] = []
