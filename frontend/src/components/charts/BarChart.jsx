/**
 * BarChart — 严重程度分布柱状图
 * Props:
 *   - vulnerabilities: array of vulnerability objects
 *   - onSeverityClick: callback(severityLabel) when a bar is clicked
 */
import { useMemo } from 'react'
import { Empty } from 'antd'
import BaseChart from './BaseChart'

const SEVERITY_LEVELS = [
  { label: '严重', min: 9, max: Infinity, color: '#f5222d' },
  { label: '高危', min: 7, max: 9, color: '#fa8c16' },
  { label: '中危', min: 4, max: 7, color: '#fadb14' },
  { label: '低危', min: 0, max: 4, color: '#52c41a' },
]

const classify = (score) => {
  if (score == null) return '未知'
  for (const level of SEVERITY_LEVELS) {
    if (score >= level.min && score < level.max) return level.label
  }
  return '未知'
}

const BarChart = ({ vulnerabilities = [], onSeverityClick, selectedSeverity }) => {
  const option = useMemo(() => {
    if (!vulnerabilities || vulnerabilities.length === 0) return null

    // Group by severity
    const counts = { '严重': 0, '高危': 0, '中危': 0, '低危': 0 }
    vulnerabilities.forEach((v) => {
      const label = classify(v.cvss_score)
      if (counts[label] !== undefined) counts[label]++
    })

    const categories = Object.keys(counts)
    const values = Object.values(counts)
    const colors = SEVERITY_LEVELS.map((l) => l.color)

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { fontSize: 13 },
      },
      yAxis: {
        type: 'value',
        name: '数量',
        minInterval: 1,
      },
      series: [
        {
          name: '漏洞数',
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: colors[i],
              ...(selectedSeverity === categories[i] ? { shadowBlur: 10, shadowColor: colors[i], opacity: 1 } : {}),
            },
            ...(selectedSeverity === categories[i] ? { selected: true } : {}),
          })),
          barWidth: '50%',
          label: {
            show: true,
            position: 'top',
            fontSize: 13,
          },
        },
      ],
    }
  }, [vulnerabilities, selectedSeverity])

  const handleEvents = useMemo(
    () => ({
      click: (params) => {
        if (onSeverityClick && params.componentType === 'series') {
          onSeverityClick(params.name)
        }
      },
    }),
    [onSeverityClick]
  )

  if (!option) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h4 className="text-base font-semibold mb-2 text-gray-700">严重程度分布</h4>
        <Empty description="暂无数据" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <h4 className="text-base font-semibold mb-2 text-gray-700">严重程度分布</h4>
      <BaseChart option={option} height={260} onEvents={handleEvents} chartType="bar" />
    </div>
  )
}

export default BarChart
