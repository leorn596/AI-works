/**
 * RadarChart — 安全态势雷达图 (T5.8 支持 multi-source 双雷达叠加)
 * Props:
 *   - vulnerabilities: array of vulnerability objects
 *   - mode: 'default' | 'multi-source' (default: 'default')
 *   - multiSourceData: { zap: [...vulns], nmap: [...vulns] } (for multi-source mode)
 * Features: 六维度安全态势评估
 */
import { useMemo } from 'react'
import { Empty } from 'antd'
import BaseChart from './BaseChart'

const RADAR_DIMENSIONS = ['发现数', '准确率', '严重度', 'CVSS均值', '覆盖面', '去重率']
const RADAR_DIMENSIONS_DEFAULT = ['严重度分布', '类型覆盖面', '平均CVSS', '最高CVSS', '漏洞密度', '影响广度']
const ALL_TYPES = ['SQLi', 'XSS', 'SSRF', 'RCE', 'LFI', 'CSRF']

const classifySeverity = (score) => {
  if (score == null) return '未知'
  if (score >= 9) return '严重'
  if (score >= 7) return '高危'
  if (score >= 4) return '中危'
  return '低危'
}

const computeMultiSourceMetrics = (vulns) => {
  if (!vulns || vulns.length === 0) return [0, 0, 0, 0, 0, 0]
  const n = vulns.length

  // 1. 发现数: normalized to 50 max
  const discoveryScore = Math.round(Math.min((n / 50) * 100, 100))

  // 2. 准确率: vulns with valid CVSS / total * 100
  const validCvss = vulns.filter((v) => v.cvss_score != null && v.cvss_score > 0).length
  const accuracyScore = Math.round((validCvss / n) * 100)

  // 3. 严重度: weighted average
  const severityWeights = { '严重': 100, '高危': 75, '中危': 50, '低危': 25, '未知': 0 }
  let severitySum = 0
  vulns.forEach((v) => { severitySum += severityWeights[classifySeverity(v.cvss_score)] || 0 })
  const severityScore = Math.round(severitySum / n)

  // 4. CVSS均值
  const scores = vulns.map((v) => v.cvss_score).filter((s) => s != null)
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const avgCvssScore = Math.round(Math.min(avgScore * 10, 100))

  // 5. 覆盖面: unique vuln types / total types
  const presentTypes = new Set(vulns.map((v) => v.vuln_type).filter(Boolean))
  const coverageScore = Math.round((presentTypes.size / ALL_TYPES.length) * 100)

  // 6. 去重率: unique names / total * 100 (higher = less duplicates)
  const uniqueNames = new Set(vulns.map((v) => v.vuln_name).filter(Boolean))
  const dedupScore = Math.round((uniqueNames.size / n) * 100)

  return [discoveryScore, accuracyScore, severityScore, avgCvssScore, coverageScore, dedupScore]
}

const computeDefaultMetrics = (vulnerabilities) => {
  if (!vulnerabilities || vulnerabilities.length === 0) return null
  const n = vulnerabilities.length

  const severityWeights = { '严重': 100, '高危': 75, '中危': 50, '低危': 25, '未知': 0 }
  let severitySum = 0
  vulnerabilities.forEach((v) => { severitySum += severityWeights[classifySeverity(v.cvss_score)] || 0 })
  const severityScore = Math.round(severitySum / n)

  const presentTypes = new Set(vulnerabilities.map((v) => v.vuln_type).filter(Boolean))
  const coverageScore = Math.round((presentTypes.size / ALL_TYPES.length) * 100)

  const scores = vulnerabilities.map((v) => v.cvss_score).filter((s) => s != null)
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const avgCvssScore = Math.round(Math.min(avgScore * 10, 100))

  const maxScore = scores.length > 0 ? Math.max(...scores) : 0
  const maxCvssScore = Math.round(Math.min(maxScore * 10, 100))

  const densityScore = Math.round(Math.min((n / 20) * 100, 100))
  const breadthScore = Math.round((presentTypes.size / ALL_TYPES.length) * 100)

  return [severityScore, coverageScore, avgCvssScore, maxCvssScore, densityScore, breadthScore]
}

const RadarChart = ({ vulnerabilities = [], mode = 'default', multiSourceData = null }) => {
  const option = useMemo(() => {
    // Multi-source mode: dual radar overlay
    if (mode === 'multi-source' && multiSourceData) {
      const zapValues = computeMultiSourceMetrics(multiSourceData.zap || [])
      const nmapValues = computeMultiSourceMetrics(multiSourceData.nmap || [])

      if (zapValues.every((v) => v === 0) && nmapValues.every((v) => v === 0)) return null

      return {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            const vals = params.value || []
            const lines = RADAR_DIMENSIONS.map((dim, i) => `${dim}: ${vals[i] || 0}`)
            return `${params.seriesName}<br/>${lines.join('<br/>')}`
          },
        },
        legend: {
          data: ['ZAP', 'Nmap'],
          bottom: 0,
          textStyle: { fontSize: 12 },
        },
        radar: {
          indicator: RADAR_DIMENSIONS.map((t) => ({ name: t, max: 100 })),
          shape: 'polygon',
          splitNumber: 4,
          axisName: { color: '#555', fontSize: 12 },
          splitLine: { lineStyle: { color: '#e8e8e8' } },
          splitArea: {
            areaStyle: { color: ['rgba(84,112,198,0.02)', 'rgba(84,112,198,0.05)'] },
          },
        },
        series: [
          {
            name: 'ZAP',
            type: 'radar',
            data: [
              {
                value: zapValues,
                name: 'ZAP',
                areaStyle: { color: 'rgba(24,144,255,0.2)' },
                lineStyle: { color: '#1890ff', width: 2 },
                itemStyle: { color: '#1890ff' },
                symbol: 'circle',
                symbolSize: 6,
              },
            ],
          },
          {
            name: 'Nmap',
            type: 'radar',
            data: [
              {
                value: nmapValues,
                name: 'Nmap',
                areaStyle: { color: 'rgba(250,140,22,0.2)' },
                lineStyle: { color: '#fa8c16', width: 2 },
                itemStyle: { color: '#fa8c16' },
                symbol: 'circle',
                symbolSize: 6,
              },
            ],
          },
        ],
      }
    }

    // Default mode: single radar
    if (!vulnerabilities || vulnerabilities.length === 0) return null
    const values = computeDefaultMetrics(vulnerabilities)
    if (!values || values.every((v) => v === 0)) return null

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const vals = params.value || []
          const lines = RADAR_DIMENSIONS_DEFAULT.map((dim, i) => `${dim}: ${vals[i] || 0}`)
          return `${params.seriesName}<br/>${lines.join('<br/>')}`
        },
      },
      radar: {
        indicator: RADAR_DIMENSIONS_DEFAULT.map((t) => ({ name: t, max: 100 })),
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: '#555', fontSize: 12 },
        splitLine: { lineStyle: { color: '#e8e8e8' } },
        splitArea: {
          areaStyle: { color: ['rgba(84,112,198,0.02)', 'rgba(84,112,198,0.05)'] },
        },
      },
      series: [
        {
          name: '安全态势评估',
          type: 'radar',
          data: [
            {
              value: values,
              name: '安全态势',
              areaStyle: { color: 'rgba(250,140,22,0.25)' },
              lineStyle: { color: '#fa8c16', width: 2 },
              itemStyle: { color: '#fa8c16' },
              symbol: 'circle',
              symbolSize: 6,
            },
          ],
        },
      ],
    }
  }, [vulnerabilities, mode, multiSourceData])

  const title = mode === 'multi-source' ? '多源对比雷达图' : '安全态势雷达图'

  if (!option) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h4 className="text-base font-semibold mb-2 text-gray-700">{title}</h4>
        <Empty description="暂无数据" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <h4 className="text-base font-semibold mb-2 text-gray-700">{title}</h4>
      <BaseChart option={option} height={280} chartType="radar" />
    </div>
  )
}

export default RadarChart
