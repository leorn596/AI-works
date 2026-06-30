import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button, Input, Tabs, Upload, Form, notification } from 'antd'
import { UploadOutlined, FileTextOutlined, LinkOutlined, InboxOutlined, SwapOutlined } from '@ant-design/icons'
import { analyzeManual, analyzeBatch, analyzeUrl, setManualVulnerabilities } from '../store/analysisSlice'
import { parseFile } from '../utils/fileParser'
import CrossValidation from './CrossValidation'

const { TextArea } = Input
const { Dragger } = Upload

// Save to history helper (module-level, uses localStorage)
const HISTORY_KEY = 'ai-vuln-history'
const saveToHistory = (format, vulnerabilities) => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history = raw ? JSON.parse(raw) : []
    history.unshift({
      format,
      count: vulnerabilities.length,
      timestamp: Date.now(),
      vulnerabilities,
    })
    // Keep max 50 records
    if (history.length > 50) history.length = 50
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // storage unavailable
  }
}

/**
 * InputSection - 漏洞输入组件
 * Props: none (uses Redux dispatch internally)
 * Features: 三种输入模式 tab 切换，手动描述 + 文件上传
 */
const InputSection = () => {
  const dispatch = useDispatch()
  const { status } = useSelector((state) => state.analysis)
  const isAnalyzing = status === 'loading' || status === 'file-analyzing'
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('manual')
  const [parsedFile, setParsedFile] = useState(null) // { format, count }
  const [fileVulns, setFileVulns] = useState(null)
  const [urlValue, setUrlValue] = useState('')
  const [urlError, setUrlError] = useState('')

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      dispatch(analyzeManual({ description: values.description, model: undefined }))
      notification.success({
        message: '分析已提交',
        description: 'AI 正在分析漏洞描述，请稍候...',
        placement: 'topRight',
      })
    } catch (err) {
      // Validation error — antd handles display
    }
  }

  // Handle file read and parse (with size check + async parsing)
  const handleUrlSubmit = () => {
    const url = urlValue.trim()
    if (!url) {
      setUrlError('请输入目标 URL')
      return
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setUrlError('URL 必须以 http:// 或 https:// 开头')
      return
    }
    if (url.length < 10) {
      setUrlError('URL 长度至少 10 个字符')
      return
    }
    setUrlError('')
    dispatch(analyzeUrl({ url }))
    notification.success({
      message: 'URL 分析已提交',
      description: 'AI 正在分析目标 URL 的安全风险，请稍候...',
      placement: 'topRight',
    })
  }

  const handleFileUpload = (file) => {
    // ── File size check ──
    const MAX_SIZE = 10 * 1024 * 1024  // 10MB
    if (file.size > MAX_SIZE) {
      notification.warning({
        message: '文件过大',
        description: `文件大小 (${(file.size / 1024 / 1024).toFixed(1)}MB) 超过 10MB 限制，请压缩报告后重试`,
        placement: 'topRight',
      })
      return false
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        // Defer parsing to avoid blocking main thread on large files
        const doParse = () => {
          try {
            const result = parseFile(content)
            if (result.vulnerabilities.length === 0) {
              notification.warning({
                message: '未发现漏洞',
                description: `已识别为 ${result.format} 格式，但未解析出漏洞数据`,
                placement: 'topRight',
              })
              return
            }
            setParsedFile({ format: result.format, count: result.vulnerabilities.length })
            setFileVulns(result.vulnerabilities)
            notification.success({
              message: '文件解析成功',
              description: `${result.format} 格式，解析出 ${result.vulnerabilities.length} 个漏洞`,
              placement: 'topRight',
            })
          } catch (parseErr) {
            notification.error({
              message: '文件解析失败',
              description: parseErr.message || '请确认文件格式正确',
              placement: 'topRight',
            })
          }
        }
        // Use requestIdleCallback for non-blocking parse, fallback to setTimeout
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(doParse, { timeout: 5000 })
        } else {
          setTimeout(doParse, 0)
        }
      } catch (err) {
        notification.error({
          message: '文件解析失败',
          description: err.message || '请确认文件格式正确',
          placement: 'topRight',
        })
      }
    }
    reader.onerror = () => {
      notification.error({
        message: '文件读取失败',
        description: '无法读取文件，请重试',
        placement: 'topRight',
      })
    }
    reader.readAsText(file)
    return false // prevent default upload
  }

  // Submit file-parsed vulns for AI analysis
  const handleFileAnalyze = () => {
    if (!fileVulns || fileVulns.length === 0) return
    // Save to history before dispatching
    saveToHistory(parsedFile?.format || 'Unknown', fileVulns)
    // First set the parsed vulns into store, then trigger AI batch analysis
    dispatch(setManualVulnerabilities(fileVulns))
    dispatch(analyzeBatch({ vulnerabilities: fileVulns }))
    notification.success({
      message: '批量分析已提交',
      description: `正在对 ${fileVulns.length} 个漏洞进行 AI 深度分析...`,
      placement: 'topRight',
    })
    // Reset local file state
    setParsedFile(null)
    setFileVulns(null)
  }

  const tabItems = [
    {
      key: 'url',
      label: (
        <span><LinkOutlined /> URL 扫描</span>
      ),
      children: (
        <div className="p-4">
          <div className="mb-2">
            <h4 className="text-sm font-medium text-gray-700 mb-2">目标 URL</h4>
            <Input
              placeholder="https://example.com/api/endpoint"
              prefix={<LinkOutlined className="text-gray-400" />}
              size="large"
              value={urlValue}
              onChange={(e) => { setUrlValue(e.target.value); setUrlError('') }}
              status={urlError ? 'error' : ''}
              disabled={isAnalyzing}
            />
            {urlError && <p className="text-red-500 text-xs mt-1">{urlError}</p>}
          </div>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <p className="text-amber-700 text-sm">
              🔍 AI 将基于 URL 结构和安全知识推理可能的漏洞风险，无需实际扫描
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'file',
      label: (
        <span><UploadOutlined /> 文件上传</span>
      ),
      children: (
        <div>
          <Dragger
            accept=".json,.xml"
            showUploadList={false}
            beforeUpload={handleFileUpload}
            disabled={isAnalyzing}
            multiple={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 ZAP JSON 和 Nmap XML 格式的安全扫描报告
            </p>
          </Dragger>
          {parsedFile && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-green-700 text-sm">
                ✅ 已解析 <strong>{parsedFile.format}</strong> 格式，共 <strong>{parsedFile.count}</strong> 个漏洞
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'multi-source',
      label: (
        <span><SwapOutlined /> 多源对比</span>
      ),
      children: <CrossValidation />,
    },
    {
      key: 'manual',
      label: (
        <span><FileTextOutlined /> 手动描述</span>
      ),
      children: (
        <Form form={form} layout="vertical">
          <Form.Item
            name="description"
            label="漏洞描述"
            rules={[
              { required: true, message: '请输入漏洞描述' },
              { min: 10, message: '描述至少需要 10 个字符' },
            ]}
          >
            <TextArea
              rows={6}
              placeholder="请详细描述您发现的漏洞，例如：在登录页面的用户名输入框中输入单引号后返回数据库错误信息..."
              maxLength={5000}
              showCount
            />
          </Form.Item>
        </Form>
      ),
    },
  ]

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">漏洞输入</h3>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
      {activeTab === 'url' && (
        <Button
          type="primary"
          size="large"
          block
          loading={isAnalyzing}
          disabled={isAnalyzing}
          onClick={handleUrlSubmit}
          className="mt-2"
        >
          {isAnalyzing ? 'AI 分析中...' : '开始 URL 分析'}
        </Button>
      )}
      {activeTab === 'manual' && (
        <Button
          type="primary"
          size="large"
          block
          loading={isAnalyzing}
          disabled={isAnalyzing}
          onClick={handleSubmit}
          className="mt-2"
        >
          {isAnalyzing ? 'AI 分析中...' : '开始 AI 分析'}
        </Button>
      )}
      {activeTab === 'file' && fileVulns && fileVulns.length > 0 && (
        <Button
          type="primary"
          size="large"
          block
          loading={status === 'file-analyzing'}
          disabled={isAnalyzing}
          onClick={handleFileAnalyze}
          className="mt-2"
        >
          {status === 'file-analyzing' ? 'AI 批量分析中...' : `开始 AI 批量分析 (${fileVulns.length} 个漏洞)`}
        </Button>
      )}
    </div>
  )
}

export default InputSection
