/**
 * ChartArea — 图表区域容器（饼图 + 柱状图 + 雷达图 + 折线图）
 * Props: none (reads vulnerabilities from Redux)
 * Features:
 *   - 从 Redux store 读取 vulnerabilities，传递给所有图表
 *   - T3.0b: 读取 currentVulnerability，传 selectedVulnType / selectedSeverity 给子图表
 *   - T3.3: 顶部筛选栏（vuln_type + severity Select），useMemo 过滤
 *   - T3.4: 图表点击 → emit('chart:filter') → AI 面板触发深度分析
 *   - T3.7: 四图 grid 布局，md:grid-cols-2
 *   - T7.1: 每个子图表独立 ErrorBoundary
 *   - T7.2: IntersectionObserver 懒加载，进入视口后才渲染
 *   - T7.5: xs/sm 单列、md 两列、lg+ 四列
 */
import React, { useMemo, useCallback, useState, lazy, Suspense } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Select, Space, Button, notification } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import ComponentErrorBoundary from './ComponentErrorBoundary'
import ChartSkeleton from './ChartSkeleton'
import useInView from '../hooks/useInView'
import { selectVulnerability } from '../store/analysisSlice'
import { emit } from '../utils/eventBus'

// BUG-01 fix: React.lazy code-splitting for chart chunks
const PieChart = lazy(() => import('./charts/PieChart'))
const BarChart = lazy(() => import('./charts/BarChart'))
const RadarChart = lazy(() => import('./charts/RadarChart'))
const TrendChart = lazy(() => import('./charts/TrendChart'))

const { Option } = Select

// Severity classification helper (matches BarChart logic)
const SEVERITY_LEVELS = [
  { label: '严重', min: 9, max: Infinity },
  { label: '高危', min: 7, max: 9 },
  { label: '中危', min: 4, max: 7 },
  { label: '低危', min: 0, max: 4 },
]

const classifySeverity = (score) => {
  if (score == null) return '未知'
  for (const level of SEVERITY_LEVELS) {
    if (score >= level.min && score < level.max) return level.label
  }
  return '未知'
}

/**
 * LazyChart — IntersectionObserver 懒加载包装器
 * 进入视口前显示 ChartSkeleton，进入后渲染子组件
 */
const LazyChart = ({ children, height = 280 }) => {
  const { ref, inView } = useInView({ rootMargin: '200px', triggerOnce: true })

  return (
    <div ref={ref}>
      {inView ? (
        <Suspense fallback={<ChartSkeleton height={height} />}>
          {children}
        </Suspense>
      ) : (
        <div style={{ height }} />
      )}
    </div>
  )
}

const ChartArea = () => {
  const dispatch = useDispatch()
  const { vulnerabilities, currentVulnerability, multiSourceResult } = useSelector((state) => state.analysis)

  // BUG-01: Unified cross-filter state (vuln_type + severity)
  const [crossFilter, setCrossFilter] = useState({ vuln_type: null, severity: null })

  // Extract unique vuln types for filter dropdown
  const vulnTypes = useMemo(() => {
    const types = new Set(vulnerabilities.map((v) => v.vuln_type).filter(Boolean))
    return Array.from(types).sort()
  }, [vulnerabilities])

  // BUG-01: Cross-filtered vulnerabilities — applied to ALL 4 charts
  const crossFilteredVulnerabilities = useMemo(() => {
    let result = vulnerabilities
    if (crossFilter.vuln_type) {
      result = result.filter((v) => v.vuln_type === crossFilter.vuln_type)
    }
    if (crossFilter.severity) {
      result = result.filter((v) => classifySeverity(v.cvss_score) === crossFilter.severity)
    }
    return result
  }, [vulnerabilities, crossFilter])

  // BUG-01: Reset all filters (both Selects and crossFilter)
  const handleResetFilter = useCallback(() => {
    setCrossFilter({ vuln_type: null, severity: null })
    notification.info({
      message: '筛选已重置',
      description: '已清除所有交叉筛选条件',
      placement: 'topRight',
    })
  }, [])

  // Chart click handlers: update crossFilter + selectVulnerability + emit for AIDetailAnalysis
  const handleTypeClick = useCallback(
    (vulnType) => {
      setCrossFilter((prev) => ({ ...prev, vuln_type: vulnType }))
      const matched = vulnerabilities.find((v) => v.vuln_type === vulnType)
      if (matched) {
        dispatch(selectVulnerability(matched))
        emit('chart:filter', { type: 'vuln_type', value: vulnType, source: 'chart' })
        notification.info({
          message: `类型筛选: ${vulnType}`,
          description: `已选中第一个 ${vulnType} 类型漏洞`,
          placement: 'topRight',
        })
      }
    },
    [vulnerabilities, dispatch]
  )

  const handleSeverityClick = useCallback(
    (severityLabel) => {
      setCrossFilter((prev) => ({ ...prev, severity: severityLabel }))
      const severityRanges = {
        '严重': [9, Infinity],
        '高危': [7, 9],
        '中危': [4, 7],
        '低危': [0, 4],
      }
      const range = severityRanges[severityLabel]
      if (!range) return
      const matched = vulnerabilities.find(
        (v) => v.cvss_score >= range[0] && v.cvss_score < range[1]
      )
      if (matched) {
        dispatch(selectVulnerability(matched))
        emit('chart:filter', { type: 'severity', value: severityLabel, source: 'chart' })
        notification.info({
          message: `严重程度筛选: ${severityLabel}`,
          description: `已选中第一个${severityLabel}级别漏洞`,
          placement: 'topRight',
        })
      }
    },
    [vulnerabilities, dispatch]
  )

  if (!vulnerabilities || vulnerabilities.length === 0) {
    return null
  }

  const hasActiveFilter = crossFilter.vuln_type !== null || crossFilter.severity !== null

  return (
    <div className="flex flex-col gap-4">
      {/* BUG-01: Unified filter bar with synced Selects + reset button */}
      <div className="bg-white rounded-lg p-3 shadow-sm">
        <Space size="middle" wrap>
          <span className="text-sm text-gray-600 font-medium">筛选：</span>
          <Select
            placeholder="漏洞类型"
            allowClear
            style={{ width: 140 }}
            value={crossFilter.vuln_type}
            onChange={(val) => setCrossFilter((prev) => ({ ...prev, vuln_type: val || null }))}
            size="small"
          >
            {vulnTypes.map((t) => (
              <Option key={t} value={t}>{t}</Option>
            ))}
          </Select>
          <Select
            placeholder="严重程度"
            allowClear
            style={{ width: 120 }}
            value={crossFilter.severity}
            onChange={(val) => setCrossFilter((prev) => ({ ...prev, severity: val || null }))}
            size="small"
          >
            <Option value="严重">严重</Option>
            <Option value="高危">高危</Option>
            <Option value="中危">中危</Option>
            <Option value="低危">低危</Option>
          </Select>
          {hasActiveFilter && (
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={handleResetFilter}
            >
              重置筛选
            </Button>
          )}
          {hasActiveFilter && (
            <span className="text-xs text-gray-400">
              显示 {crossFilteredVulnerabilities.length} / {vulnerabilities.length}
            </span>
          )}
        </Space>
      </div>

      {/* Four charts in responsive grid — T7.1: each wrapped in ErrorBoundary + T7.2: lazy load */}
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        <LazyChart height={280}>
          <ComponentErrorBoundary name="饼图">
            <PieChart
              vulnerabilities={crossFilteredVulnerabilities}
              onTypeClick={handleTypeClick}
              selectedVulnType={crossFilter.vuln_type}
            />
          </ComponentErrorBoundary>
        </LazyChart>

        <LazyChart height={260}>
          <ComponentErrorBoundary name="柱状图">
            <BarChart
              vulnerabilities={crossFilteredVulnerabilities}
              onSeverityClick={handleSeverityClick}
              selectedSeverity={crossFilter.severity}
            />
          </ComponentErrorBoundary>
        </LazyChart>

        <LazyChart height={280}>
          <ComponentErrorBoundary name="雷达图">
            {multiSourceResult?.cross_validation ? (
              <RadarChart
                mode="multi-source"
                multiSourceData={{
                  zap: multiSourceResult.cross_validation.zap_only || [],
                  nmap: multiSourceResult.cross_validation.nmap_only || [],
                }}
              />
            ) : (
              <RadarChart vulnerabilities={crossFilteredVulnerabilities} />
            )}
          </ComponentErrorBoundary>
        </LazyChart>

        <LazyChart height={300}>
          <ComponentErrorBoundary name="趋势图">
            <TrendChart vulnerabilities={crossFilteredVulnerabilities} />
          </ComponentErrorBoundary>
        </LazyChart>
      </div>
    </div>
  )
}

export default ChartArea
