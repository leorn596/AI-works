/**
 * HistoryPanel — 分析历史记录面板（三栏布局左侧）
 * Migrated to API (Sprint 4):
 *   - 从 /api/history 获取历史记录（分页）
 *   - 支持时间范围 + vuln_type 筛选
 *   - 点击历史记录 → fetch /api/history/{task_id} → 加载到右侧 AIDetailAnalysis
 *   - Loading / Error / Empty 三态
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
  Space,
} from 'antd'
import {
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useDispatch } from 'react-redux'
import { setManualVulnerabilities, setChecklist, setTaskId } from '../store/analysisSlice'

const { Text } = Typography
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

const HistoryPanel = () => {
  const dispatch = useDispatch()

  // Data state
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Query state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dateRange, setDateRange] = useState(null) // [dayjs, dayjs] or null
  const [vulnType, setVulnType] = useState('')

  // Detail loading state
  const [loadingDetail, setLoadingDetail] = useState(null) // task_id or null

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

  const handleLoadDetail = useCallback(
    async (taskId) => {
      setLoadingDetail(taskId)
      try {
        const resp = await fetch(`/api/history/${taskId}`)
        const data = await resp.json()

        if (data.code !== 200) {
          throw new Error(data.message || '加载详情失败')
        }

        const vulns = data.data.vulnerabilities || []
        if (vulns.length > 0) {
          dispatch(setManualVulnerabilities(vulns))
        }
        // T6.0: Also load checklist from history detail (DB completion state)
        if (data.data.checklist) {
          dispatch(setChecklist(data.data.checklist))
        }
        // T6.0: Set taskId for export functionality
        dispatch(setTaskId(taskId))
      } catch (err) {
        // Silently log; user can retry
        console.error('Failed to load task detail:', err)
      } finally {
        setLoadingDetail(null)
      }
    },
    [dispatch]
  )

  const handleSearch = useCallback(() => {
    setPage(1) // Reset to first page on new search
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

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-semibold text-gray-700 flex items-center gap-1">
          <HistoryOutlined /> 分析历史
        </h4>
        <Button
          size="small"
          type="text"
          icon={<ReloadOutlined />}
          onClick={fetchHistory}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-3 space-y-2">
        <Select
          size="small"
          style={{ width: '100%' }}
          value={vulnType}
          onChange={setVulnType}
          options={VULN_TYPES}
          placeholder="漏洞类型"
        />
        <RangePicker
          size="small"
          style={{ width: '100%' }}
          value={dateRange}
          onChange={setDateRange}
          placeholder={['开始日期', '结束日期']}
        />
        <Button
          size="small"
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleSearch}
          block
        >
          查询
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spin tip="加载中..." />
          </div>
        ) : error ? (
          <Alert
            type="error"
            message="加载失败"
            description={error}
            showIcon
            className="mb-2"
            action={
              <Button size="small" onClick={fetchHistory}>
                重试
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <Empty description="暂无历史记录" />
        ) : (
          <List
            size="small"
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                className="cursor-pointer hover:bg-gray-50 rounded px-2 transition-colors"
                actions={[
                  <Button
                    key="load"
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={loadingDetail === item.id}
                    onClick={() => handleLoadDetail(item.id)}
                  >
                    加载
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Text ellipsis style={{ maxWidth: 140 }}>
                      #{item.id} — {item.input_type}
                    </Text>
                  }
                  description={
                    <div>
                      <Tag color="blue">
                        {item.vuln_count} 个漏洞
                      </Tag>
                      {item.cvss_overall != null && (
                        <Tag color={cvssColor(item.cvss_overall)}>
                          CVSS {item.cvss_overall.toFixed(1)}
                        </Tag>
                      )}
                      <Text type="secondary" className="text-xs">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString('zh-CN')
                          : ''}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showTotal={(t) => `共 ${t} 条`}
            onChange={handlePageChange}
            pageSizeOptions={['10', '20', '50']}
          />
        </div>
      )}
    </div>
  )
}

export default HistoryPanel
