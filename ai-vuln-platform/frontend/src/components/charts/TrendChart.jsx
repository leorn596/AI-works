/**
 * TrendChart — 漏洞发现时间趋势折线图（多系列）
 * Props:
 *   - vulnerabilities: array of vulnerability objects
 * Features:
 *   - 按 vuln_type 分组，每种类型一条线（独立颜色）
 *   - 真实 time 轴（有 created_at 时）或按日期排序 category 轴
 *   - 无时间字段时标注"模拟数据"并合理降级
 *   - smooth curve + areaStyle 渐变
 *   - legend 支持多系列
 */
import { useMemo } from 'react'
import { Empty } from 'antd'
import BaseChart from './BaseChart'

// 为每种漏洞类型分配固定颜色
const VULN_TYPE_COLORS = {
  SQLi:    '#e74c3c',
  XSS:     '#f39c12',
  SSRF:    '#3498db',
  RCE:     '#9b59b6',
  LFI:     '#1abc9c',
  CSRF:    '#e67e22',
  XXE:     '#2ecc71',
  Auth:    '#e91e63',
  IDOR:    '#00bcd4',
  SSTI:    '#ff5722',
  UNKNOWN: '#95a5a6',
}

const FALLBACK_COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#48b8d0',
]

const getTypeColor = (type, index) => {
  return VULN_TYPE_COLORS[type] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

const TrendChart = ({ vulnerabilities = [] }) => {
  const { option, isSimulated } = useMemo(() => {
    if (!vulnerabilities || vulnerabilities.length === 0) {
      return { option: null, isSimulated: false }
    }

    const hasTimeField = vulnerabilities.some((v) => v.created_at)
    let simulated = false

    // ─── Group by vuln_type ───
    const typeGroups = new Map()
    vulnerabilities.forEach((v) => {
      const vtype = v.vuln_type || 'UNKNOWN'
      if (!typeGroups.has(vtype)) typeGroups.set(vtype, [])
      typeGroups.get(vtype).push(v)
    })

    // ─── Build time labels ───
    let timeLabels = []
    // Map: type -> Map<dateKey, count>
    const typeDateMaps = new Map()

    if (hasTimeField) {
      // Collect all unique dates across all types, sorted
      const allDates = new Set()
      typeGroups.forEach((vulns, vtype) => {
        const dateMap = new Map()
        vulns
          .filter((v) => v.created_at)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .forEach((v) => {
            const dateKey = v.created_at.slice(0, 10)
            dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
            allDates.add(dateKey)
          })
        typeDateMaps.set(vtype, dateMap)
      })
      timeLabels = [...allDates].sort()
    } else {
      // Simulated: divide into chunks
      simulated = true
      const maxLen = Math.max(...[...typeGroups.values()].map((v) => v.length))
      const chunkSize = Math.max(1, Math.ceil(maxLen / 8))
      const chunkCount = Math.ceil(maxLen / chunkSize)

      for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize + 1
        const end = Math.min((i + 1) * chunkSize, maxLen)
        timeLabels.push(`样本 ${start}-${end}`)
      }

      typeGroups.forEach((vulns, vtype) => {
        const dateMap = new Map()
        for (let i = 0; i < vulns.length; i += chunkSize) {
          const chunkLabel = `样本 ${i + 1}-${Math.min(i + chunkSize, vulns.length)}`
          dateMap.set(chunkLabel, vulns.slice(i, i + chunkSize).length)
        }
        typeDateMaps.set(vtype, dateMap)
      })
    }

    if (timeLabels.length === 0) {
      return { option: null, isSimulated: false }
    }

    // ─── Build cumulative series per type ───
    const series = []
    const legendData = []
    const colorPalette = []

    let colorIdx = 0
    typeGroups.forEach((vulns, vtype) => {
      legendData.push(vtype)
      const color = getTypeColor(vtype, colorIdx++)
      colorPalette.push(color)

      const dateMap = typeDateMaps.get(vtype) || new Map()
      let cumulative = 0
      const data = timeLabels.map((label) => {
        cumulative += dateMap.get(label) || 0
        return cumulative
      })

      series.push({
        name: vtype,
        type: 'line',
        smooth: true,
        data,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color.replace(')', ',0.3)').replace('rgb', 'rgba') },
              { offset: 1, color: color.replace(')', ',0.02)').replace('rgb', 'rgba') },
            ],
          },
        },
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        symbol: 'circle',
        symbolSize: 5,
      })
    })

    // ─── Also add total cumulative line ───
    const totalCounts = []
    let totalCum = 0
    const allDateMap = new Map()
    typeDateMaps.forEach((dateMap) => {
      dateMap.forEach((count, date) => {
        allDateMap.set(date, (allDateMap.get(date) || 0) + count)
      })
    })
    timeLabels.forEach((label) => {
      totalCum += allDateMap.get(label) || 0
      totalCounts.push(totalCum)
    })
    legendData.unshift('合计')
    series.unshift({
      name: '合计',
      type: 'line',
      smooth: true,
      data: totalCounts,
      lineStyle: { color: '#333', width: 3, type: 'dashed' },
      itemStyle: { color: '#333' },
      symbol: 'diamond',
      symbolSize: 7,
      areaStyle: undefined,
    })

    return {
      option: {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        legend: {
          data: legendData,
          top: 0,
          textStyle: { fontSize: 12 },
          type: 'scroll',
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: '40',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: timeLabels,
          axisLabel: {
            fontSize: 11,
            rotate: timeLabels.length > 6 ? 30 : 0,
          },
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          name: '累计漏洞数',
          minInterval: 1,
        },
        color: ['#333', ...colorPalette],
        series,
      },
      isSimulated: simulated,
    }
  }, [vulnerabilities])

  if (!option) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h4 className="text-base font-semibold mb-2 text-gray-700">漏洞发现趋势</h4>
        <Empty description="暂无数据" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-base font-semibold text-gray-700">漏洞发现趋势</h4>
        {isSimulated && (
          <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
            模拟数据
          </span>
        )}
      </div>
      <BaseChart option={option} height={300} chartType="trend" />
    </div>
  )
}

export default TrendChart
