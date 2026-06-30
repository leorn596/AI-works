import { useEffect } from 'react'
import { Card, Tag, Descriptions, Empty, Typography } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import { on, off } from '../utils/eventBus'
import { selectVulnerability } from '../store/analysisSlice'
import RemediationChecklist from './RemediationChecklist'
import ExportActions from './ExportActions'

const { Paragraph } = Typography

/**
 * AIDetailAnalysis - AI分析详情组件
 * Props: none (uses Redux currentVulnerability)
 * Features:
 *   - 展示选中漏洞的完整分析详情
 *   - T6.3: 顶部集成 ExportActions 导出按钮
 */
const AIDetailAnalysis = () => {
  const dispatch = useDispatch()
  const { currentVulnerability, summary, cvssOverall, status, vulnerabilities, taskId } = useSelector(
    (state) => state.analysis
  )

  // T3.4: Subscribe to chart:filter events
  // BUG-03 fix: Only select vulnerability for display, do NOT dispatch analyzeManual
  // (analyzeManual overwrites Redux vulnerabilities with API response)
  useEffect(() => {
    const handler = ({ type, value }) => {
      let matched = null
      if (type === 'vuln_type') {
        matched = vulnerabilities.find((v) => v.vuln_type === value)
      } else if (type === 'severity') {
        const severityRanges = {
          '严重': [9, Infinity],
          '高危': [7, 9],
          '中危': [4, 7],
          '低危': [0, 4],
        }
        const range = severityRanges[value]
        if (range) {
          matched = vulnerabilities.find(
            (v) => v.cvss_score >= range[0] && v.cvss_score < range[1]
          )
        }
      }
      if (matched) {
        // Only select the vulnerability for side-panel display
        dispatch(selectVulnerability(matched))
      }
    }
    on('chart:filter', handler)
    return () => off('chart:filter', handler)
  }, [vulnerabilities, dispatch])

  if (status === 'success' && !currentVulnerability) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm h-full">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">AI 分析详情</h3>
        <Empty description="请在左侧选择一个漏洞查看详情" />
      </div>
    )
  }

  if (!currentVulnerability) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm h-full flex items-center justify-center">
        <Empty description="输入漏洞描述并点击分析，AI 将为您识别潜在漏洞" />
      </div>
    )
  }

  const v = currentVulnerability

  const severityColor = (score) => {
    if (score >= 9) return 'red'
    if (score >= 7) return 'orange'
    if (score >= 4) return 'gold'
    return 'green'
  }

  const severityLabel = (score) => {
    if (score >= 9) return '严重'
    if (score >= 7) return '高危'
    if (score >= 4) return '中危'
    return '低危'
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">AI 分析详情</h3>
        {status === 'success' && <ExportActions taskId={taskId} />}
      </div>

      <Card size="small" className="mb-4">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="漏洞名称" span={2}>
            <span className="font-semibold">{v.vuln_name}</span>
          </Descriptions.Item>
          <Descriptions.Item label="漏洞类型">
            <Tag color="blue">{v.vuln_type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="严重程度">
            <Tag color={severityColor(v.cvss_score)}>
              {severityLabel(v.cvss_score)} ({v.cvss_score?.toFixed(1)})
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="CVSS 向量" span={2}>
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
              {v.cvss_vector}
            </code>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="漏洞描述" size="small" className="mb-4">
        <Paragraph>{v.description}</Paragraph>
      </Card>

      <Card title="修复方案" size="small" className="mb-4">
        <Paragraph>{v.remediation}</Paragraph>
      </Card>

      {summary && (
        <Card title="总体评估" size="small">
          <Paragraph>{summary}</Paragraph>
          {cvssOverall !== null && (
            <div className="mt-2">
              <Tag color={severityColor(cvssOverall)} className="text-sm">
                综合 CVSS: {cvssOverall?.toFixed(1)} ({severityLabel(cvssOverall)})
              </Tag>
            </div>
          )}
        </Card>
      )}

      {/* T5.6: Remediation Checklist */}
      <RemediationChecklist />
    </div>
  )
}

export default AIDetailAnalysis
