/**
 * LayoutContainer - 全断点响应式布局容器（支持双栏/三栏切换）
 * Props: none
 * Breakpoints:
 *   - xs  <576px:  单栏上下堆叠，图表全宽
 *   - sm  ≥576px:  单栏上下堆叠
 *   - md  ≥768px:  单栏，图表2列并排
 *   - lg  ≥1024px: 双栏(左输入+列表+图表 / 右分析) 或 三栏
 *   - xl  ≥1280px: 双栏全宽 / 三栏全宽
 *
 * T3.5: 三栏模式 — 左(历史记录 25%) / 中(图表区 40%) / 右(AI分析 35%)
 *        按钮切换，仅 xl≥1280px 生效
 * T7.1: 每个核心组件包裹独立 ComponentErrorBoundary
 * T7.5: 断点自适应 + xs/sm 图表单列
 */
import { useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { Alert, Button, Tooltip } from 'antd'
import { ColumnWidthOutlined, TableOutlined } from '@ant-design/icons'
import ComponentErrorBoundary from './ComponentErrorBoundary'
import InputSection from './InputSection'
import VulnerabilityList from './VulnerabilityList'
import AIDetailAnalysis from './AIDetailAnalysis'
import AnalysisProgress from './AnalysisProgress'
import ChartArea from './ChartArea'
import HistoryPanel from './HistoryPanel'
import { emit } from '../utils/eventBus'

const LayoutContainer = () => {
  const { status, error } = useSelector((state) => state.analysis)
  const isLoading = status === 'loading' || status === 'file-analyzing'
  const [threeCol, setThreeCol] = useState(false)

  // T7.4: Emit layout:resize so charts can adjust after CSS grid transition
  const handleToggleLayout = useCallback(() => {
    setThreeCol((prev) => {
      // Defer resize event to next frame after state update + re-render
      requestAnimationFrame(() => {
        emit('layout:resize', { threeCol: !prev })
      })
      return !prev
    })
  }, [])

  return (
    <div className="w-full">
      {/* Error alert */}
      {error && (
        <div className="mx-4 mt-4">
          <Alert
            type="error"
            message={error}
            showIcon
            closable
            action={
              <Button size="small" danger onClick={() => window.location.reload()}>
                重试
              </Button>
            }
          />
        </div>
      )}

      {/* Progress bar during analysis */}
      {isLoading && <AnalysisProgress />}

      {/* Layout toggle button */}
      <div className="flex justify-end px-4 pt-3">
        <Tooltip title={threeCol ? '切换双栏布局' : '切换三栏布局（含历史记录）'}>
          <Button
            size="small"
            icon={threeCol ? <ColumnWidthOutlined /> : <TableOutlined />}
            onClick={handleToggleLayout}
          >
            {threeCol ? '双栏' : '三栏'}
          </Button>
        </Tooltip>
      </div>

      {/* Responsive grid */}
      {threeCol ? (
        /* T3.5: Three-column layout: history(25%) / charts(40%) / ai(35%) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1.6fr_1.4fr] gap-4 p-4">
          {/* Left: History */}
          <div className="flex flex-col gap-4 min-w-0">
            <ComponentErrorBoundary name="历史记录">
              <HistoryPanel />
            </ComponentErrorBoundary>
          </div>

          {/* Center: Input + Vulnerability List + Charts */}
          <div className="flex flex-col gap-4 min-w-0">
            <ComponentErrorBoundary name="漏洞输入">
              <InputSection />
            </ComponentErrorBoundary>
            <ComponentErrorBoundary name="漏洞列表">
              <VulnerabilityList />
            </ComponentErrorBoundary>
            <ComponentErrorBoundary name="图表区域">
              <ChartArea />
            </ComponentErrorBoundary>
          </div>

          {/* Right: AI Analysis */}
          <div className="flex flex-col min-w-0">
            <ComponentErrorBoundary name="AI 分析详情">
              <AIDetailAnalysis />
            </ComponentErrorBoundary>
          </div>
        </div>
      ) : (
        /* Default two-column layout */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          {/* Left Panel */}
          <div className="flex flex-col gap-4 min-w-0">
            <ComponentErrorBoundary name="漏洞输入">
              <InputSection />
            </ComponentErrorBoundary>
            <ComponentErrorBoundary name="漏洞列表">
              <VulnerabilityList />
            </ComponentErrorBoundary>
            <ComponentErrorBoundary name="图表区域">
              <ChartArea />
            </ComponentErrorBoundary>
          </div>

          {/* Right Panel */}
          <div className="flex flex-col min-w-0">
            <ComponentErrorBoundary name="AI 分析详情">
              <AIDetailAnalysis />
            </ComponentErrorBoundary>
          </div>
        </div>
      )}
    </div>
  )
}

export default LayoutContainer
