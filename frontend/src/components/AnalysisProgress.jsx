import { Progress, Typography } from 'antd'
import { useState, useEffect } from 'react'

const { Text } = Typography

/**
 * AnalysisProgress - 分析进度组件
 * Props: none
 * Features: 分析中显示进度条 + 当前阶段文字
 */
const AnalysisProgress = () => {
  const [percent, setPercent] = useState(0)
  const [stage, setStage] = useState('正在连接 AI 分析引擎...')

  useEffect(() => {
    const stages = [
      { pct: 15, text: '正在连接 AI 分析引擎...' },
      { pct: 35, text: '正在解析漏洞描述...' },
      { pct: 55, text: '正在识别漏洞类型...' },
      { pct: 75, text: '正在计算 CVSS 评分...' },
      { pct: 90, text: '正在生成修复建议...' },
      { pct: 95, text: '正在整理分析报告...' },
    ]

    let idx = 0
    const timer = setInterval(() => {
      if (idx < stages.length) {
        setPercent(stages[idx].pct)
        setStage(stages[idx].text)
        idx++
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="mx-4 mt-4 bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        <Text strong>{stage}</Text>
      </div>
      <Progress percent={percent} status="active" strokeColor="#1677ff" />
    </div>
  )
}

export default AnalysisProgress
