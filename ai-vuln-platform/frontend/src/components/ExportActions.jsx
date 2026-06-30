/**
 * ExportActions — 导出操作组件 (T6.2/T6.4)
 * Props:
 *   - taskId: number, current analysis task ID
 * Features:
 *   - 导出 PNG 按钮（通过 eventBus 触发所有图表导出）
 *   - 导出 PDF 按钮（调用后端 API 下载 PDF）
 *   - Loading 状态 + 成功/失败通知
 *   - 仅在分析完成后显示
 */
import { useState, useCallback } from 'react'
import { Button, Space, Dropdown, message, Spin } from 'antd'
import {
  FileImageOutlined,
  FilePdfOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { emit } from '../utils/eventBus'

const ExportActions = ({ taskId }) => {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pngLoading, setPngLoading] = useState(false)

  const handleExportPDF = useCallback(async (mode = 'full') => {
    if (!taskId) {
      message.warning('请先完成漏洞分析')
      return
    }
    setPdfLoading(true)
    try {
      const resp = await fetch(`/api/report/${taskId}/pdf?mode=${mode}`)
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.detail || `HTTP ${resp.status}`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `vuln_report_${taskId}_${mode}.pdf`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      message.success('PDF 报告已下载')
    } catch (err) {
      console.error('PDF export failed:', err)
      message.error(`PDF 导出失败：${err.message}`)
    } finally {
      setPdfLoading(false)
    }
  }, [taskId])

  const handleExportPNG = useCallback(() => {
    setPngLoading(true)
    try {
      // Emit batch export event — all BaseChart instances will respond
      emit('chart:exportAll')
      message.success('正在导出所有图表 PNG...')
    } catch (err) {
      console.error('PNG export failed:', err)
      message.error('PNG 导出失败')
    } finally {
      setPngLoading(false)
    }
  }, [])

  if (!taskId) return null

  const pdfMenuItems = [
    {
      key: 'full',
      label: '完整报告（含漏洞明细 + 加固清单）',
      icon: <FilePdfOutlined />,
      onClick: () => handleExportPDF('full'),
    },
    {
      key: 'summary',
      label: '摘要报告（仅概览）',
      icon: <FilePdfOutlined />,
      onClick: () => handleExportPDF('summary'),
    },
  ]

  return (
    <Spin spinning={pdfLoading || pngLoading} size="small">
      <Space size="small">
        <Button
          size="small"
          icon={<FileImageOutlined />}
          loading={pngLoading}
          onClick={handleExportPNG}
        >
          导出 PNG
        </Button>
        <Dropdown
          menu={{ items: pdfMenuItems }}
          placement="bottomRight"
          disabled={pdfLoading}
        >
          <Button
            size="small"
            type="primary"
            icon={pdfLoading ? <LoadingOutlined /> : <FilePdfOutlined />}
            loading={pdfLoading}
          >
            导出 PDF
          </Button>
        </Dropdown>
      </Space>
    </Spin>
  )
}

export default ExportActions
