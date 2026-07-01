/**
 * RemediationChecklist — 安全加固清单组件 (T5.6)
 * 展示为 Timeline + Checkbox
 * 按类别筛选：配置/代码/网络/权限 Segmented 切换
 * 标记完成状态持久化到 localStorage
 */
import { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Card, Checkbox, Segmented, Empty, Tag, Typography, Timeline } from 'antd'
import {
  SettingOutlined,
  CodeOutlined,
  GlobalOutlined,
  SafetyOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
} from '@ant-design/icons'

const { Text, Paragraph } = Typography

const STORAGE_KEY = 'remediation-checklist-state'

const CATEGORY_CONFIG = {
  '全部': { icon: null, color: 'default' },
  '配置': { icon: <SettingOutlined />, color: 'blue' },
  '代码': { icon: <CodeOutlined />, color: 'purple' },
  '网络': { icon: <GlobalOutlined />, color: 'cyan' },
  '权限': { icon: <SafetyOutlined />, color: 'orange' },
}

const PRIORITY_LABEL = (p) => {
  const map = { 1: '紧急', 2: '高', 3: '中', 4: '低', 5: '信息' }
  return map[p] || '中'
}

const PRIORITY_COLOR = (p) => {
  if (p <= 1) return 'red'
  if (p <= 2) return 'orange'
  if (p <= 3) return 'gold'
  if (p <= 4) return 'blue'
  return 'default'
}

// Parse structured checklist item text: [P{n}][{category}] {title}: {detail}
function parseChecklistItem(item) {
  // Structured object with category field (from backend API)
  if (item && typeof item === 'object' && 'category' in item) {
    return {
      priority: parseInt(item.priority, 10) || 3,
      category: item.category || '配置',
      title: item.title || '',
      detail: item.detail || '',
    }
  }

  // Legacy string format: extract item_text
  const text = item.item_text || (typeof item === 'string' ? item : '')
  if (typeof text !== 'string') return { priority: 3, category: '配置', title: '', detail: '' }

  const match = text.match(/^\[P(\d)\]\[([^\]]+)\]\s*(.+?)(?::\s*(.*))?$/)
  if (match) {
    return {
      priority: parseInt(match[1], 10),
      category: match[2],
      title: match[3] || '',
      detail: match[4] || '',
    }
  }
  // Fallback for unstructured text
  return { priority: 3, category: '配置', title: text.slice(0, 60), detail: text }
}

const RemediationChecklist = () => {
  const { checklist: rawChecklist, status } = useSelector((state) => state.analysis)

  // Load completed state from localStorage (fallback when DB completion not available)
  const [completedMap, setCompletedMap] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  const [filterCategory, setFilterCategory] = useState('全部')

  // T6.0: Sync DB completion state into localStorage on checklist change
  useEffect(() => {
    if (!rawChecklist || rawChecklist.length === 0) return
    const dbUpdates = {}
    let hasUpdates = false
    rawChecklist.forEach((item, idx) => {
      if (item.is_completed !== undefined) {
        dbUpdates[idx] = !!item.is_completed
        hasUpdates = true
      }
    })
    if (hasUpdates) {
      setCompletedMap((prev) => {
        // Merge: DB state wins for items that have it, keep localStorage for rest
        const merged = { ...prev, ...dbUpdates }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        } catch { /* storage unavailable */ }
        return merged
      })
    }
  }, [rawChecklist])

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedMap))
    } catch {
      // storage unavailable
    }
  }, [completedMap])

  const toggleComplete = (idx) => {
    setCompletedMap((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  // Parse all checklist items
  const parsed = useMemo(() => {
    if (!rawChecklist || rawChecklist.length === 0) return []
    return rawChecklist.map((item, idx) => ({
      ...parseChecklistItem(item),
      id: item.id || idx,
      idx,
    }))
  }, [rawChecklist])

  // Filter by category
  const filtered = useMemo(() => {
    if (filterCategory === '全部') return parsed
    return parsed.filter((p) => p.category === filterCategory)
  }, [parsed, filterCategory])

  if (status !== 'success' || !rawChecklist || rawChecklist.length === 0) {
    return null
  }

  const completedCount = parsed.filter((p) => completedMap[p.idx]).length
  const totalCount = parsed.length

  return (
    <Card
      title={
        <span>
          🛡️ 安全加固清单{' '}
          <Tag color={completedCount === totalCount ? 'green' : 'blue'}>
            {completedCount}/{totalCount} 已完成
          </Tag>
        </span>
      }
      size="small"
      className="mt-4"
    >
      <Segmented
        options={Object.keys(CATEGORY_CONFIG).map((cat) => ({
          label: (
            <span>
              {CATEGORY_CONFIG[cat].icon} {cat}
            </span>
          ),
          value: cat,
        }))}
        value={filterCategory}
        onChange={setFilterCategory}
        className="mb-4"
        block
      />

      {filtered.length === 0 ? (
        <Empty description="该类别暂无加固项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Timeline
          items={filtered.map((item) => ({
            dot: completedMap[item.idx] ? (
              <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
            ) : (
              <ClockCircleFilled style={{ color: '#faad14', fontSize: 16 }} />
            ),
            children: (
              <div
                className={`p-2 rounded ${completedMap[item.idx] ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={!!completedMap[item.idx]}
                    onChange={() => toggleComplete(item.idx)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag color={PRIORITY_COLOR(item.priority)}>
                        P{item.priority} {PRIORITY_LABEL(item.priority)}
                      </Tag>
                      <Tag color={CATEGORY_CONFIG[item.category]?.color || 'default'}>
                        {item.category}
                      </Tag>
                      <Text
                        strong
                        delete={!!completedMap[item.idx]}
                        className="text-sm"
                      >
                        {item.title}
                      </Text>
                    </div>
                    {item.detail && (
                      <Paragraph
                        className="text-xs text-gray-500 mt-1 mb-0"
                        ellipsis={{ rows: 2, expandable: true }}
                      >
                        {item.detail}
                      </Paragraph>
                    )}
                  </div>
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  )
}

export default RemediationChecklist
