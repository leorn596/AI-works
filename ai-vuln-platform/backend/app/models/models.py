"""SQLAlchemy ORM models."""
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    DateTime,
    Enum,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class AnalysisTask(Base):
    """Analysis task record."""
    __tablename__ = "analysis_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    input_type = Column(String(20), nullable=False, default="manual")  # manual/url/file
    input_content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    status = Column(
        Enum("pending", "processing", "completed", "failed", name="task_status"),
        nullable=False,
        default="pending",
        index=True,
    )
    summary = Column(Text, nullable=True)
    cvss_overall = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vulnerabilities = relationship("Vulnerability", back_populates="task", cascade="all, delete-orphan")
    remediation_items = relationship("RemediationChecklist", back_populates="task", cascade="all, delete-orphan")


class Vulnerability(Base):
    """Individual vulnerability found in analysis."""
    __tablename__ = "vulnerabilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("analysis_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    vuln_name = Column(String(200), nullable=False)
    vuln_type = Column(String(50), nullable=False, index=True)  # SQLi, XSS, SSRF, etc.
    cvss_vector = Column(String(200), nullable=True)
    cvss_score = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    remediation = Column(Text, nullable=True)
    raw_ai_response = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    task = relationship("AnalysisTask", back_populates="vulnerabilities")


class RemediationChecklist(Base):
    """Remediation checklist items for a task."""
    __tablename__ = "remediation_checklists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("analysis_tasks.id", ondelete="CASCADE"), nullable=False)
    item_text = Column(Text, nullable=False)
    is_completed = Column(Integer, default=0)  # 0=pending, 1=done
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    task = relationship("AnalysisTask", back_populates="remediation_items")
