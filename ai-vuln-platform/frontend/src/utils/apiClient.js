/**
 * apiClient — 带自动重试和指数退避的 fetch 包装
 * 
 * Features:
 *   - 失败自动重试 3 次（指数退避 1s/2s/4s）
 *   - 超时 60s（可自定义）
 *   - 500/503 等服务端错误也触发重试
 *   - 统一 { code, message, data } 解析
 */

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 60000 // 60s
const RETRYABLE_STATUS = new Set([500, 502, 503, 504])

/**
 * Wait for a specified duration
 * @param {number} ms - milliseconds to wait
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Check if a request should be retried
 * @param {Response} response
 * @param {Error} error
 * @returns {boolean}
 */
const shouldRetry = (response, error) => {
  // Network errors
  if (error) return true
  // Server errors (500/503/etc.)
  if (response && RETRYABLE_STATUS.has(response.status)) return true
  return false
}

/**
 * Fetch with automatic retry, exponential backoff, and timeout
 * 
 * @param {string} url - Request URL
 * @param {Object} options - fetch options
 * @param {number} options.timeout - timeout in ms (default 60000)
 * @param {number} options.maxRetries - max retry count (default 3)
 * @param {AbortSignal} options.signal - external AbortSignal
 * @returns {Promise<Object>} - parsed JSON { code, message, data }
 */
const apiClient = async (url, options = {}) => {
  const {
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    signal: externalSignal,
    ...fetchOptions
  } = options

  let lastError = null
  let lastResponse = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Create a timeout controller for this attempt
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout)

    // Combine external signal with timeout signal
    const combinedSignal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutController.signal])
      : timeoutController.signal

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: combinedSignal,
      })

      clearTimeout(timeoutId)
      lastResponse = response
      lastError = null

      // If it's a retryable server error, retry
      if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        console.warn(
          `[apiClient] ${url} 返回 ${response.status}，第 ${attempt + 1}/${maxRetries} 次重试，等待 ${backoff}ms...`
        )
        await sleep(backoff)
        continue
      }

      // Parse JSON response
      const data = await response.json()
      return data

    } catch (err) {
      clearTimeout(timeoutId)
      lastError = err

      // If externally aborted, don't retry
      if (externalSignal?.aborted) {
        throw err
      }

      // Timeout or network error — retry
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 1000
        console.warn(
          `[apiClient] ${url} 请求失败 (${err.name || err.message})，第 ${attempt + 1}/${maxRetries} 次重试，等待 ${backoff}ms...`
        )
        await sleep(backoff)
        continue
      }
    }
  }

  // All retries exhausted
  if (lastError) {
    if (lastError.name === 'AbortError') {
      throw new Error('请求超时，请重试')
    }
    throw lastError
  }

  // If we got here with a response, parse it
  if (lastResponse) {
    return lastResponse.json()
  }

  throw new Error('网络错误，请检查网络连接')
}

export default apiClient
