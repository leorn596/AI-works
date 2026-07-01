/**
 * History — 独立历史记录页面
 * T9.2: 全宽渲染，复用 HistoryPanel 的 API 逻辑
 * 支持分页、日期筛选、类型筛选、点击加载详情
 */
import { useState, useEffect, useCallback } from 'react'
import {
  List,
  Button,
  Empty,
  Tag,
  Typography,
  Pagination,
  Select,
  DatePicker,
  Spin,
  Alert,
  Card,
  Descriptions,
  Collapse,
  Drawer,
} from 'antd'
import {
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useDispatch } from 'react-redux'
import { setManualVulnerabilities, setChecklist, setTaskId } from '../store/analysisSlice'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const VULN_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'SQLi', label: 'SQLi' },
  { value: 'XSS', label: 'XSS' },
  { value: 'SSRF', label: 'SSRF' },
  { value: 'RCE', label: 'RCE' },
  { value: 'LFI', label: 'LFI' },
  { value: 'CSRF', label: 'CSRF' },
  { value: 'XXE', label: 'XXE' },
  { value: 'Auth', label: 'Auth' },
]

const INPUT_TYPE_LABELS = {
  manual: '手动描述',
  file: '文件上传',
  url: 'URL 分析',
  multi: '多源对比',
}

const History = () => {
  const dispatch = useDispatch()

  // Data state
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Query state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dateRange, setDateRange] = useState(null)
  const [vulnType, setVulnType] = useState('')

  // Detail drawer
  const [detailDrawer, setDetailDrawer] = useState({ open: false, loading: false, data: null, error: null })

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', page)
      params.set('page_size', pageSize)
      if (dateRange && dateRange[0]) {
        params.set('start_date', dateRange[0].format('YYYY-MM-DD'))
      }
      if (dateRange && dateRange[1]) {
        params.set('end_date', dateRange[1].format('YYYY-MM-DD'))
      }
      if (vulnType) {
        params.set('vuln_type', vulnType)
      }

      const resp = await fetch(`/api/history?${params.toString()}`)
      const data = await resp.json()

      if (data.code !== 200) {
        throw new Error(data.message || '获取历史记录失败')
      }

      setItems(data.data.items || [])
      setTotal(data.data.total || 0)
    } catch (err) {
      setError(err.message || '网络错误')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, dateRange, vulnType])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleLoadDetail = useCallback(async (taskId) => {
    setDetailDrawer({ open: true, loading: true, data: null, error: null })
    try {
      const resp = await fetch(`/api/history/${taskId}`)
      const data = await resp.json()

      if (data.code !== 200) {
        throw new Error(data.message || '加载详情失败')
      }

      setDetailDrawer({ open: true, loading: false, data: data.data, error: null })

      // Also load into Redux store for navigation to Dashboard if needed
      const vulns = data.data.vulnerabilities || []
      if (vulns.length > 0) {
        dispatch(setManualVulnerabilities(vulns))
      }
      if (data.data.checklist) {
        dispatch(setChecklist(data.data.checklist))
      }
      dispatch(setTaskId(taskId))
    } catch (err) {
      setDetailDrawer({ open: true, loading: false, data: null, error: err.message || '加载失败' })
    }
  }, [dispatch])

  const handleSearch = useCallback(() => {
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage, newPageSize) => {
    setPage(newPage)
    setPageSize(newPageSize)
  }, [])

  const cvssColor = (score) => {
    if (score >= 9) return 'red'
    if (score >= 7) return 'orange'
    if (score >= 4) return 'gold'
    return 'green'
  }

  const renderDetailContent = () => {
    const { data } = detailDrawer
    if (!data) return null

    const vulnColumns = [
      { title: '漏洞名称', dataIndex: 'vuln_name', key: 'vuln_name', width: 180 },
      { title: '类型', dataIndex: 'vuln_type', key: 'vuln_type', width: 80, render: (t) => <Tag color="blue">{t}</Tag> },
      {
        title: 'CVSS',
        dataIndex: 'cvss_score',
        key: 'cvss_score',
        width: 80,
        render: (s) => s != null ? <Tag color={cvssColor(s)}>{s.toFixed(1)}</Tag> : '-',
      },
      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
      { title: '修复方案', dataIndex: 'remediation', key: 'remediation', ellipsis: true },
    ]

    return (
      <div className="space-y-4">
        {/* Task info */}
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="任务 ID">#{data.id}</Descriptions.Item>
          <Descriptions.Item label="输入类型">
            <Tag color="purple">{INPUT_TYPE_LABELS[data.input_type] || data.input_type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={data.status === 'completed' ? 'green' : 'orange'}>{data.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="CVSS 综合评分">
            {data.cvss_overall != null ? (
              <Tag color={cvssColor(data.cvss_overall)}>{data.cvss_overall.toFixed(1)}</Tag>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {data.created_at ? new Date(data.created_at).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
          {data.summary && (
            <Descriptions.Item label="分析摘要" span={2}>
              {data.summary}
            </Descriptions.Item>
          )}
          {data.input_content && (
            <Descriptions.Item label="输入内容" span={2}>
              <Text ellipsis style={{ maxWidth: 600 }} copyable>{data.input_content}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Vulnerabilities */}
        {data.vulnerabilities && data.vulnerabilities.length > 0 && (
          <Card title={<><FileTextOutlined /> 漏洞列表 ({data.vulnerabilities.length})</>} size="small">
            <div className="space-y-3">
              {data.vulnerabilities.map((v, idx) => (
                <Card key={v.id || idx} size="small" className="bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Text strong>{v.vuln_name}</Text>
                      <Tag color="blue" className="ml-2">{v.vuln_type}</Tag>
                      {v.cvss_score != null && (
                        <Tag color={cvssColor(v.cvss_score)} className="ml-1">
                          CVSS {v.cvss_score.toFixed(1)}
                        </Tag>
                      )}
                    </div>
                  </div>
                  {v.description && (
                    <div className="mb-2">
                      <Text type="secondary" className="text-xs">描述：</Text>
                      <p className="text-sm text-gray-700 mt-1">{v.description}</p>
                    </div>
                  )}
                  {v.remediation && (
                    <div>
                      <Text type="secondary" className="text-xs">修复方案：</Text>
                      <p className="text-sm text-green-700 mt-1">{v.remediation}</p>
                    </div>
                  )}
                  {v.cvss_vector && (
                    <Text type="secondary" className="text-xs mt-2 block">
                      CVSS 向量: {v.cvss_vector}
                    </Text>
                  )}
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Checklist */}
        {data.checklist && data.checklist.length > 0 && (
          <Collapse
            size="small"
            items={[{
              key: 'checklist',
              label: `安全加固清单 (${data.checklist.length} 项)`,
              children: (
                <ul className="space-y-2">
                  {data.checklist.map((item, idx) => (
                    <li key={item.id || idx} className="flex items-start gap-2">
                      <Tag color={item.is_completed ? 'green' : 'default'}>
                        {item.is_completed ? '✓' : '○'}
                      </Tag>
                      <Text className={item.is_completed ? 'line-through text-gray-400' : ''}>
                        {item.item_text}
                      </Text>
                    </li>
                  ))}
                </ul>
              ),
            }]}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Title level={3} className="!mb-0 flex items-center gap-2">
          <HistoryOutlined /> 分析历史
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchHistory}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* Filters */}
      <Card size="small" className="mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[180px]">
            <Text type="secondary" className="text-xs block mb-1">漏洞类型</Text>
            <Select
              style={{ width: '100%' }}
              value={vulnType}
              onChange={setVulnType}
              options={VULN_TYPES}
              placeholder="漏洞类型"
            />
          </div>
          <div className="min-w-[280px]">
            <Text type="secondary" className="text-xs block mb-1">日期范围</Text>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
            />
          </div>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
          >
            查询
          </Button>
          {(vulnType || dateRange) && (
            <Button
              onClick={() => { setVulnType(''); setDateRange(null); setPage(1) }}
            >
              重置
            </Button>
          )}
        </div>
      </Card>

      {/* Content */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spin tip="加载中..." size="large" />
          </div>
        ) : error ? (
          <Alert
            type="error"
            message="加载失败"
            description={error}
            showIcon
            action={
              <Button size="small" onClick={fetchHistory}>重试</Button>
            }
          />
        ) : items.length === 0 ? (
          <Empty description="暂无历史记录" />
        ) : (
          <>
            <List
              dataSource={items}
              renderItem={(item) => (
                <List.Item
                  className="cursor-pointer hover:bg-blue-50 rounded-lg px-4 py-3 transition-colors"
                  actions={[
                    <Button
                      key="detail"
                      type="primary"
                      size="small"
                      ghost
                      onClick={(e) => { e.stopPropagation(); handleLoadDetail(item.id) }}
                    >
                      查看详情
                    </Button>,
                  ]}
                  onClick={() => handleLoadDetail(item.id)}
                >
                  <List.Item.Meta
                    title={
                      <div className="flex items-center gap-2">
                        <Text strong>#{item.id}</Text>
                        <Tag color="purple">{INPUT_TYPE_LABELS[item.input_type] || item.input_type}</Tag>
                        <Text type="secondary" className="text-sm font-normal">
                          {item.summary ? (item.summary.length > 60 ? item.summary.slice(0, 60) + '...' : item.summary) : ''}
                        </Text>
                      </div>
                    }
                    description={
                      <div className="flex items-center gap-3 mt-1">
                        <Tag color="blue">{item.vuln_count} 个漏洞</Tag>
                        {item.cvss_overall != null && (
                          <Tag color={cvssColor(item.cvss_overall)}>
                            CVSS {item.cvss_overall.toFixed(1)}
                          </Tag>
                        )}
                        <Text type="secondary" className="text-xs">
                          {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />

            {/* Pagination */}
            {total > 0 && (
              <div className="mt-4 flex justify-end">
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger
                  showTotal={(t) => `共 ${t} 条记录`}
                  onChange={handlePageChange}
                  pageSizeOptions={['10', '20', '50']}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={detailDrawer.data ? `分析详情 #${detailDrawer.data.id}` : '分析详情'}
        open={detailDrawer.open}
        onClose={() => setDetailDrawer({ open: false, loading: false, data: null, error: null })}
        width={800}
        destroyOnClose
      >
        {detailDrawer.loading ? (
          <div className="flex items-center justify-center py-16">
            <Spin tip="加载详情中..." size="large" />
          </div>
        ) : detailDrawer.error ? (
          <Alert
            type="error"
            message="加载失败"
            description={detailDrawer.error}
            showIcon
          />
        ) : (
          renderDetailContent()
        )}
      </Drawer>
    </div>
  )
}

export default History
