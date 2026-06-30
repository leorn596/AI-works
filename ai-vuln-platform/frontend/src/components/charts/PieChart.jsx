/**
 * PieChart — 漏洞类型分布饼图
 * Props:
 *   - vulnerabilities: array of vulnerability objects
 *   - onTypeClick: callback(vulnType) when a slice is clicked
 */
import { useMemo } from 'react'
import { Empty } from 'antd'
import BaseChart from './BaseChart'

const COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666',
  '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
  '#ea7ccc', '#48b8d0',
]

const PieChart = ({ vulnerabilities = [], onTypeClick, selectedVulnType }) => {
  const option = useMemo(() => {
    if (!vulnerabilities || vulnerabilities.length === 0) return null

    // Group by vuln_type
    const typeMap = {}
    vulnerabilities.forEach((v) => {
      const type = v.vuln_type || 'UNKNOWN'
      typeMap[type] = (typeMap[type] || 0) + 1
    })

    const data = Object.entries(typeMap)
      .map(([name, value]) => ({
        name,
        value,
        ...(selectedVulnType === name ? { selected: true } : {}),
      }))
      .sort((a, b) => b.value - a.value)

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        type: 'scroll',
      },
      color: COLORS,
      series: [
        {
          name: '漏洞类型',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 12,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          data,
        },
      ],
    }
  }, [vulnerabilities, selectedVulnType])

  const handleEvents = useMemo(
    () => ({
      click: (params) => {
        if (onTypeClick && params.componentType === 'series') {
          onTypeClick(params.name)
        }
      },
    }),
    [onTypeClick]
  )

  if (!option) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h4 className="text-base font-semibold mb-2 text-gray-700">漏洞类型分布</h4>
        <Empty description="暂无数据" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <h4 className="text-base font-semibold mb-2 text-gray-700">漏洞类型分布</h4>
      <BaseChart option={option} height={280} onEvents={handleEvents} chartType="pie" />
    </div>
  )
}

export default PieChart
