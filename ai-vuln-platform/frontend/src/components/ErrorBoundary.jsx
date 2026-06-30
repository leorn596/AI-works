import { Component } from 'react'
import { Button, Result } from 'antd'

/**
 * ErrorBoundary - 全局错误边界组件
 * Props: { children }
 * Features: 捕获渲染错误，显示降级UI + 重试按钮
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Result
            status="error"
            title="页面渲染出错"
            subTitle={this.state.error?.message || '发生了未知错误'}
            extra={[
              <Button type="primary" key="retry" onClick={this.handleRetry}>
                重试
              </Button>,
              <Button key="reload" onClick={() => window.location.reload()}>
                刷新页面
              </Button>,
            ]}
          />
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
