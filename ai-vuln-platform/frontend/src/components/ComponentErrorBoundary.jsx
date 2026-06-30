/**
 * ComponentErrorBoundary — 组件级错误边界
 * Props:
 *   - children: React children
 *   - name: 组件名称（用于显示）
 *   - fallback: 可选自定义 fallback
 * Features: Card + "组件加载失败" + 重试按钮
 */
import { Component } from 'react'
import { Card, Button, Typography } from 'antd'
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons'

const { Text } = Typography

class ComponentErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ComponentErrorBoundary] ${this.props.name || 'Component'} caught:`, error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const name = this.props.name || '组件'

      return (
        <Card
          size="small"
          className="shadow-sm"
          style={{ borderColor: '#ffccc7' }}
        >
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <WarningOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />
            <Text type="danger" className="text-sm">
              {name}加载失败
            </Text>
            <Text type="secondary" className="text-xs">
              {this.state.error?.message || '发生了未知错误'}
            </Text>
            <Button
              type="primary"
              size="small"
              icon={<ReloadOutlined />}
              onClick={this.handleRetry}
            >
              重试
            </Button>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}

export default ComponentErrorBoundary
