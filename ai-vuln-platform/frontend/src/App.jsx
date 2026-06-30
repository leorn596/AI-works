/**
 * App — 根应用组件
 * T7.7: 全局 Ant Design notification 配置
 */
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu, notification } from 'antd'
import { DashboardOutlined, HistoryOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import Dashboard from './pages/Dashboard'
import History from './pages/History'

const { Header, Content } = Layout

const AppLayout = () => {
  const location = useLocation()
  const { error, status } = useSelector((state) => state.analysis)
  const [api, contextHolder] = notification.useNotification()

  // T7.7: Global error notification on analysis rejection
  useEffect(() => {
    if (status === 'error' && error) {
      api.error({
        message: '分析失败',
        description: error,
        placement: 'topRight',
        duration: 6,
      })
    }
  }, [status, error, api])

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">漏洞分析</Link>,
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: <Link to="/history">分析历史</Link>,
    },
  ]

  return (
    <Layout className="min-h-screen">
      {contextHolder}
      <Header className="flex items-center px-6 shadow-sm" style={{ background: '#001529' }}>
        <div className="text-white text-lg font-bold mr-8 whitespace-nowrap">
          🛡️ AI 漏洞分析平台
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="flex-1"
        />
      </Header>
      <Content className="bg-gray-50">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Content>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
