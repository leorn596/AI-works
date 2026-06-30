-- ============================================================
-- AI 安全漏洞分析平台 — 数据库初始化脚本
-- Sprint 1: 与 ORM 模型一致的表结构
-- MySQL 8.x
-- ============================================================

CREATE DATABASE IF NOT EXISTS vuln_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vuln_platform;

-- ============================================================
-- analysis_tasks: 分析任务主表
-- ============================================================
CREATE TABLE IF NOT EXISTS analysis_tasks (
    id              INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    input_type      VARCHAR(20)     NOT NULL DEFAULT 'manual' COMMENT '输入类型: manual/url/file',
    input_content   TEXT            NOT NULL COMMENT '用户提交的分析内容',
    model_used      VARCHAR(100)    NULL     COMMENT '使用的 AI 模型名称',
    status          ENUM('pending', 'processing', 'completed', 'failed')
                        NOT NULL DEFAULT 'pending' COMMENT '任务状态',
    summary         TEXT            NULL     COMMENT 'AI 分析摘要',
    cvss_overall    FLOAT           NULL     COMMENT '综合 CVSS 评分',
    error_message   TEXT            NULL     COMMENT '失败时的错误信息',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_created_status (created_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='分析任务表';

-- ============================================================
-- vulnerabilities: 漏洞明细表（关联分析任务）
-- ============================================================
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id              INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id         INT             NOT NULL COMMENT '关联分析任务 ID',
    vuln_name       VARCHAR(200)    NOT NULL COMMENT '漏洞名称',
    vuln_type       VARCHAR(50)     NOT NULL COMMENT '漏洞类型: SQLi/XSS/SSRF 等',
    cvss_vector     VARCHAR(200)    NULL     COMMENT 'CVSS 向量字符串',
    cvss_score      FLOAT           NULL     COMMENT 'CVSS 评分',
    description     TEXT            NULL     COMMENT '漏洞描述',
    remediation     TEXT            NULL     COMMENT '修复建议',
    raw_ai_response JSON            NULL     COMMENT 'AI 原始响应（结构化 JSON）',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    CONSTRAINT fk_vuln_task
        FOREIGN KEY (task_id)
        REFERENCES analysis_tasks(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_task_id (task_id),
    INDEX idx_vuln_type (vuln_type),
    INDEX idx_task_vulntype (task_id, vuln_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='漏洞明细表';

-- ============================================================
-- remediation_checklists: 修复清单表
-- ============================================================
CREATE TABLE IF NOT EXISTS remediation_checklists (
    id              INT             NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id         INT             NOT NULL COMMENT '关联分析任务 ID',
    item_text       TEXT            NOT NULL COMMENT '修复项描述',
    is_completed    INT             NOT NULL DEFAULT 0 COMMENT '是否完成: 0=待处理, 1=已完成',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    CONSTRAINT fk_checklist_task
        FOREIGN KEY (task_id)
        REFERENCES analysis_tasks(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    INDEX idx_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='修复清单表';
