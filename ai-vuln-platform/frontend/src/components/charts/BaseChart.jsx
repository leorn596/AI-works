/**
 * BaseChart — ECharts 通用基类组件
 * Props:
 *   - option: ECharts option object
 *   - height: chart height (default 300px)
 *   - loading: boolean, show loading skeleton
 *   - onEvents: object of event handlers { click: fn, ... }
 *   - chartType: string, chart identifier for export filename (T6.1)
 * Features:
 *   - T7.4: 监听 visibilitychange 修复标签页切换后尺寸塌陷
 *   - T7.4: ResizeObserver 完善容器 resize 响应
 *   - T7.4: 布局切换时主动调用 echartsInstance.resize()
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import * as echarts from 'echarts'
import { Button, Tooltip, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import ChartSkeleton from '../ChartSkeleton'
import { on, off } from '../../utils/eventBus'

const BaseChart = ({ option, height = 300, loading = false, onEvents, chartType = 'chart' }) => {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  // Initialize chart and handle resize
  const initChart = useCallback(() => {
    if (!containerRef.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current)
    }
    if (option) {
      chartRef.current.setOption(option, true)
    }
    // Bind events
    if (onEvents && chartRef.current) {
      Object.entries(onEvents).forEach(([eventName, handler]) => {
        chartRef.current.on(eventName, handler)
      })
    }
  }, [option, onEvents])

  useEffect(() => {
    if (loading) return

    initChart()

    // ResizeObserver for responsive sizing
    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.resize()
      }
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // T7.4: Listen for visibilitychange to fix size collapse when switching tabs
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && chartRef.current) {
        // Small delay to ensure the browser has finished layout
        requestAnimationFrame(() => {
          if (chartRef.current) {
            chartRef.current.resize()
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // T7.4: Listen for window resize
    const handleWindowResize = () => {
      if (chartRef.current) {
        chartRef.current.resize()
      }
    }
    window.addEventListener('resize', handleWindowResize)

    return () => {
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', handleWindowResize)
      if (chartRef.current) {
        chartRef.current.dispose()
        chartRef.current = null
      }
    }
  }, [loading, initChart])

  // Update option when it changes
  useEffect(() => {
    if (chartRef.current && option && !loading) {
      chartRef.current.setOption(option, true)
    }
  }, [option, loading])

  // T6.3: Listen for batch PNG export event from ExportActions
  useEffect(() => {
    const handleExportAll = () => {
      if (!chartRef.current) return
      try {
        const dataURL = chartRef.current.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff',
        })
        const link = document.createElement('a')
        link.download = `${chartType}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`
        link.href = dataURL
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (err) {
        console.error(`Batch export failed for ${chartType}:`, err)
      }
    }
    on('chart:exportAll', handleExportAll)
    return () => off('chart:exportAll', handleExportAll)
  }, [chartType])

  // T7.4: Listen for layout switch events to trigger resize
  useEffect(() => {
    const handleLayoutResize = () => {
      if (chartRef.current) {
        // Defer to next frame to let CSS grid settle
        requestAnimationFrame(() => {
          if (chartRef.current) {
            chartRef.current.resize()
          }
        })
      }
    }
    on('layout:resize', handleLayoutResize)
    return () => off('layout:resize', handleLayoutResize)
  }, [])

  // T6.1: Export chart as PNG
  const handleExportPNG = useCallback(() => {
    if (!chartRef.current) {
      message.error('图表尚未初始化，无法导出')
      return
    }
    setExporting(true)
    try {
      const dataURL = chartRef.current.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff',
      })
      // Create hidden <a> tag to trigger download
      const link = document.createElement('a')
      link.download = `${chartType}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`
      link.href = dataURL
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('图表已导出为 PNG')
    } catch (err) {
      console.error('Chart export failed:', err)
      message.error('图表导出失败')
    } finally {
      setExporting(false)
    }
  }, [chartType])

  if (loading) {
    return <ChartSkeleton height={height} />
  }

  return (
    <div className="relative">
      {/* T6.1: Download button in top-right corner */}
      <Tooltip title="导出 PNG">
        <Button
          type="text"
          size="small"
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={handleExportPNG}
          className="absolute top-0 right-0 z-10 opacity-60 hover:opacity-100"
          aria-label="导出图表为 PNG"
        />
      </Tooltip>
      <div
        ref={containerRef}
        style={{ width: '100%', height: `${height}px` }}
      />
    </div>
  )
}

export default BaseChart
