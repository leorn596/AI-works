import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import apiClient from '../utils/apiClient'

// Async thunk for manual analysis (with 60s timeout via apiClient)
export const analyzeManual = createAsyncThunk(
  'analysis/analyzeManual',
  async ({ description, model }, { rejectWithValue }) => {
    try {
      const data = await apiClient('/api/analyze/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, model }),
        timeout: 60000,
        maxRetries: 3,
      })
      if (data.code !== 200) {
        return rejectWithValue(data.message || '分析失败')
      }
      return data.data
    } catch (err) {
      return rejectWithValue(err.message || '网络错误')
    }
  }
)

// Async thunk for batch AI analysis of file-parsed vulnerabilities
export const analyzeBatch = createAsyncThunk(
  'analysis/analyzeBatch',
  async ({ vulnerabilities }, { rejectWithValue }) => {
    try {
      const data = await apiClient('/api/analyze/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vulnerabilities }),
        timeout: 120000, // 120s for batch
        maxRetries: 3,
      })
      if (data.code !== 200) {
        return rejectWithValue(data.message || '批量分析失败')
      }
      return data.data
    } catch (err) {
      return rejectWithValue(err.message || '网络错误')
    }
  }
)

// T5.1: Async thunk for multi-source cross-validation analysis
export const analyzeMultiSource = createAsyncThunk(
  'analysis/analyzeMultiSource',
  async ({ zap_vulnerabilities, nmap_vulnerabilities }, { rejectWithValue }) => {
    try {
      const data = await apiClient('/api/analyze/multi-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zap_vulnerabilities, nmap_vulnerabilities }),
        timeout: 120000,
        maxRetries: 3,
      })
      if (data.code !== 200) {
        return rejectWithValue(data.message || '多源对比分析失败')
      }
      return data.data
    } catch (err) {
      return rejectWithValue(err.message || '网络错误')
    }
  }
)

const analysisSlice = createSlice({
  name: 'analysis',
  initialState: {
    status: 'idle', // idle | loading | success | error | file-analyzing | multi-analyzing
    vulnerabilities: [],
    currentReport: null,
    currentVulnerability: null,
    error: null,
    summary: '',
    cvssOverall: null,
    batchProgress: null, // { current, total } for batch progress tracking
    // T5.1: Multi-source state
    multiSourceResult: null, // { cross_validation, summary, cvss_overall }
    checklist: [], // T5.5: remediation checklist
    taskId: null, // T6.2: current task ID for export
  },
  reducers: {
    clearAnalysis(state) {
      state.status = 'idle'
      state.vulnerabilities = []
      state.currentReport = null
      state.currentVulnerability = null
      state.error = null
      state.summary = ''
      state.cvssOverall = null
      state.batchProgress = null
      state.multiSourceResult = null
      state.checklist = []
      state.taskId = null
    },
    selectVulnerability(state, action) {
      state.currentVulnerability = action.payload
    },
    // Set vulnerabilities parsed from file upload
    setManualVulnerabilities(state, action) {
      const vulns = action.payload
      state.vulnerabilities = vulns
      state.status = 'success'
      state.error = null
      state.summary = `已从文件解析 ${vulns.length} 个漏洞`
      // Select first vulnerability
      if (vulns.length > 0) {
        state.currentVulnerability = vulns[0]
      }
    },
    // T6.0: Set checklist from history detail (includes DB completion state)
    setChecklist(state, action) {
      state.checklist = action.payload || []
    },
    // T6.0: Set task ID from history detail
    setTaskId(state, action) {
      state.taskId = action.payload || null
    },
  },
  extraReducers: (builder) => {
    builder
      // Manual analysis
      .addCase(analyzeManual.pending, (state) => {
        state.status = 'loading'
        state.error = null
        state.vulnerabilities = []
        state.currentVulnerability = null
        state.batchProgress = null
        state.checklist = []
      })
      .addCase(analyzeManual.fulfilled, (state, action) => {
        state.status = 'success'
        state.vulnerabilities = action.payload.vulnerabilities || []
        state.summary = action.payload.summary || ''
        state.cvssOverall = action.payload.cvss_overall || null
        state.checklist = action.payload.checklist || []
        state.taskId = action.payload.task_id || null
        if (state.vulnerabilities.length > 0) {
          state.currentVulnerability = state.vulnerabilities[0]
        }
      })
      .addCase(analyzeManual.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.payload || '未知错误'
      })
      // Batch analysis
      .addCase(analyzeBatch.pending, (state) => {
        state.status = 'file-analyzing'
        state.error = null
        state.batchProgress = { current: 0, total: 0 }
        state.checklist = []
      })
      .addCase(analyzeBatch.fulfilled, (state, action) => {
        state.status = 'success'
        state.vulnerabilities = action.payload.vulnerabilities || []
        state.summary = action.payload.summary || ''
        state.cvssOverall = action.payload.cvss_overall || null
        state.batchProgress = null
        state.checklist = action.payload.checklist || []
        state.taskId = action.payload.task_id || null
        if (state.vulnerabilities.length > 0) {
          state.currentVulnerability = state.vulnerabilities[0]
        }
      })
      .addCase(analyzeBatch.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.payload || '批量分析失败'
        state.batchProgress = null
      })
      // T5.1: Multi-source analysis
      .addCase(analyzeMultiSource.pending, (state) => {
        state.status = 'multi-analyzing'
        state.error = null
        state.multiSourceResult = null
      })
      .addCase(analyzeMultiSource.fulfilled, (state, action) => {
        state.status = 'success'
        state.multiSourceResult = action.payload
        state.summary = action.payload.summary || ''
        state.cvssOverall = action.payload.cvss_overall || null
        state.taskId = action.payload.task_id || null
      })
      .addCase(analyzeMultiSource.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.payload || '多源对比分析失败'
      })
  },
})

export const { clearAnalysis, selectVulnerability, setManualVulnerabilities, setChecklist, setTaskId } = analysisSlice.actions
export default analysisSlice.reducer
