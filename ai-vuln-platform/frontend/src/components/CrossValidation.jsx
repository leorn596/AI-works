/**
 * CrossValidation — 多源交叉验证结果展示 (T5.2)
 * 四象限展示：✅ 双方一致 / 🔵 ZAP独有 / 🟠 Nmap独有 / ⚠️ 冲突项
 * 每个区域可展开查看具体漏洞列表
 */
import { useState, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Card, Collapse, Tag, Empty, Button, notification, Upload, Space } from 'antd'
import {
  CheckCircleOutlined,
  BugOutlined,
  WarningOutlined,
  UploadOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { analyzeMultiSource } from '../store/analysisSlice'
import { parseFile } from '../utils/fileParser'
import ExportActions from './ExportActions'

const { Dragger } = Upload

const CONFIDENCE_COLOR = (c) => {
  if (c >= 0.8) return 'green'
  if (c >= 0.5) return 'gold'
  return 'red'
}

const VulnCard = ({ vuln, source }) => (
  <div className="p-3 bg-gray-50 rounded mb-2 border-l-4 border-blue-400">
    <div className="flex justify-between items-start">
      <span className="font-medium text-sm">{vuln.vuln_name || vuln.name || '未知漏洞'}</span>
      {vuln.cvss_score != null && (
        <Tag color={vuln.cvss_score >= 7 ? 'red' : vuln.cvss_score >= 4 ? 'orange' : 'green'}>
          CVSS {vuln.cvss_score?.toFixed(1)}
        </Tag>
      )}
    </div>
    {vuln.vuln_type && <Tag className="mt-1" color="blue">{vuln.vuln_type}</Tag>}
    {source && <Tag className="mt-1" color="purple">{source}</Tag>}
    {vuln.description && (
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{vuln.description}</p>
    )}
  </div>
)

const MatchCard = ({ item }) => (
  <div className="p-3 bg-green-50 rounded mb-2 border border-green-200">
    <div className="flex items-center gap-2 mb-2">
      <Tag color={CONFIDENCE_COLOR(item.confidence)}>
        置信度 {(item.confidence * 100).toFixed(0)}%
      </Tag>
      {item.match_reason && <span className="text-xs text-gray-500">{item.match_reason}</span>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <div className="text-xs text-gray-400 mb-1">ZAP</div>
        <VulnCard vuln={item.zap_vuln || {}} />
      </div>
      <div>
        <div className="text-xs text-gray-400 mb-1">Nmap</div>
        <VulnCard vuln={item.nmap_vuln || {}} />
      </div>
    </div>
  </div>
)

const CrossValidation = () => {
  const dispatch = useDispatch()
  const { multiSourceResult, status, taskId } = useSelector((state) => state.analysis)
  const isAnalyzing = status === 'multi-analyzing'

  const [zapFile, setZapFile] = useState(null)
  const [nmapFile, setNmapFile] = useState(null)
  const [zapVulns, setZapVulns] = useState(null)
  const [nmapVulns, setNmapVulns] = useState(null)

  const cv = multiSourceResult?.cross_validation

  const sections = useMemo(() => {
    if (!cv) return []
    return [
      {
        key: 'matched',
        label: '✅ 双方一致',
        count: cv.matched?.length || 0,
        color: '#52c41a',
        items: cv.matched || [],
        render: (item, idx) => <MatchCard key={idx} item={item} />,
      },
      {
        key: 'zap_only',
        label: '🔵 ZAP 独有',
        count: cv.zap_only?.length || 0,
        color: '#1890ff',
        items: cv.zap_only || [],
        render: (item, idx) => <VulnCard key={idx} vuln={item} source="ZAP" />,
      },
      {
        key: 'nmap_only',
        label: '🟠 Nmap 独有',
        count: cv.nmap_only?.length || 0,
        color: '#fa8c16',
        items: cv.nmap_only || [],
        render: (item, idx) => <VulnCard key={idx} vuln={item} source="Nmap" />,
      },
      {
        key: 'conflict',
        label: '⚠️ 冲突项',
        count: cv.conflict?.length || 0,
        color: '#ff4d4f',
        items: cv.conflict || [],
        render: (item, idx) => <MatchCard key={idx} item={item} />,
      },
    ]
  }, [cv])

  const handleFileParse = (file, setter, label) => {
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      notification.warning({ message: '文件过大', description: `${label} 文件超过 10MB 限制` })
      return false
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result = parseFile(e.target.result)
        setter(result.vulnerabilities)
        notification.success({
          message: `${label} 解析成功`,
          description: `${result.format} 格式，${result.vulnerabilities.length} 个漏洞`,
        })
      } catch (err) {
        notification.error({ message: `${label} 解析失败`, description: err.message })
      }
    }
    reader.readAsText(file)
    return false
  }

  const handleSubmit = () => {
    if (!zapVulns || !nmapVulns) return
    dispatch(analyzeMultiSource({
      zap_vulnerabilities: zapVulns,
      nmap_vulnerabilities: nmapVulns,
    }))
  }

  // If no result yet, show upload form
  if (!multiSourceResult) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">多源对比分析</h3>
        <p className="text-sm text-gray-500 mb-4">
          上传 ZAP 和 Nmap 扫描报告，AI 将进行交叉验证分析
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="text-sm font-medium mb-2">ZAP 报告</h4>
            <Upload
              accept=".json,.xml"
              showUploadList={false}
              beforeUpload={(f) => handleFileParse(f, setZapVulns, 'ZAP')}
              disabled={isAnalyzing}
            >
              <Button icon={<UploadOutlined />} size="small">
                {zapVulns ? `✅ 已加载 ${zapVulns.length} 个漏洞` : '上传 ZAP 报告'}
              </Button>
            </Upload>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Nmap 报告</h4>
            <Upload
              accept=".json,.xml"
              showUploadList={false}
              beforeUpload={(f) => handleFileParse(f, setNmapVulns, 'Nmap')}
              disabled={isAnalyzing}
            >
              <Button icon={<UploadOutlined />} size="small">
                {nmapVulns ? `✅ 已加载 ${nmapVulns.length} 个漏洞` : '上传 Nmap 报告'}
              </Button>
            </Upload>
          </div>
        </div>
        <Button
          type="primary"
          block
          loading={isAnalyzing}
          disabled={!zapVulns || !nmapVulns || isAnalyzing}
          onClick={handleSubmit}
        >
          {isAnalyzing ? 'AI 交叉验证分析中...' : '开始多源对比分析'}
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">交叉验证结果</h3>
        <Space>
          <ExportActions taskId={taskId} />
          <Tag color="blue">
            ZAP: {cv?.zap_only?.length || 0} 独有
          </Tag>
          <Tag color="orange">
            Nmap: {cv?.nmap_only?.length || 0} 独有
          </Tag>
          <Tag color="green">
            匹配: {cv?.matched?.length || 0}
          </Tag>
          <Tag color="red">
            冲突: {cv?.conflict?.length || 0}
          </Tag>
        </Space>
      </div>

      <Collapse
        defaultActiveKey={['matched', 'conflict']}
        items={sections.map((sec) => ({
          key: sec.key,
          label: (
            <span>
              {sec.label}{' '}
              <Tag color={sec.color} className="ml-1">{sec.count}</Tag>
            </span>
          ),
          children: sec.items.length > 0 ? (
            sec.items.map((item, idx) => sec.render(item, idx))
          ) : (
            <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ),
        }))}
      />
    </div>
  )
}

export default CrossValidation
