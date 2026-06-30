import { Skeleton } from 'antd'

/**
 * ChartSkeleton - 图表区加载骨架屏
 * Props: { height?: number }
 * Features: ECharts 图表占位骨架屏
 */
const ChartSkeleton = ({ height = 300 }) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <Skeleton.Input active block style={{ width: '40%', height: 24 }} className="mb-3" />
      <Skeleton.Input active block style={{ width: '100%', height }} />
    </div>
  )
}

export default ChartSkeleton
