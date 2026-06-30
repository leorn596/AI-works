/**
 * fileParser.js — 文件解析 + 数据清洗管道
 * 支持两种格式：
 *   - ZAP JSON: 解析 site[].alerts[]
 *   - Nmap XML: 解析 <host><ports><port>
 * 输出统一格式：[{ vuln_name, vuln_type, severity, description }]
 */

/**
 * 检测文件格式
 * @param {string} content - 文件文本内容
 * @returns {'zap-json' | 'nmap-xml' | 'unknown'}
 */
function detectFormat(content) {
  const trimmed = content.trim()
  // ZAP JSON: contains "site" array with "alerts"
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.alerts) {
        return 'zap-json'
      }
      if (parsed.site && Array.isArray(parsed.site)) {
        return 'zap-json'
      }
      // ZAP 2.15+ format: top-level has @name, @host, alerts
      if (parsed['@name'] || parsed.alerts) {
        return 'zap-json'
      }
    } catch {
      // not valid JSON
    }
  }
  // Nmap XML: contains <nmaprun> or <host>
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<nmaprun') || trimmed.includes('<host ')) {
    return 'nmap-xml'
  }
  return 'unknown'
}

/**
 * ZAP severity 映射：riskcode → 标准化 severity
 * 3=High, 2=Medium, 1=Low, 0=Informational
 */
function mapZapSeverity(riskcode) {
  const code = Number(riskcode)
  if (code === 3) return 'high'
  if (code === 2) return 'medium'
  if (code === 1) return 'low'
  return 'info'
}

/**
 * 解析 ZAP JSON 格式
 * @param {string} content
 * @returns {Array<{ vuln_name, vuln_type, severity, description }>}
 */
function parseZapJson(content) {
  const raw = JSON.parse(content)
  let sites = []

  // Handle different ZAP JSON structures
  if (Array.isArray(raw)) {
    sites = raw
  } else if (raw.site && Array.isArray(raw.site)) {
    sites = raw.site
  } else if (raw.alerts) {
    // Single site object
    sites = [raw]
  } else {
    return []
  }

  const results = []
  for (const site of sites) {
    const alerts = site.alerts || site.alert || []
    const alertList = Array.isArray(alerts) ? alerts : [alerts]

    for (const alert of alertList) {
      const name = alert.name || alert.alert || alert['@name'] || '未知漏洞'
      const riskcode = alert.riskcode ?? alert.riskCode ?? alert.risk_code ?? 0
      const desc = alert.desc || alert.description || ''
      const solution = alert.solution || alert.remediation || ''
      const cweid = alert.cweid || alert.cweId || alert.cwe || ''
      const pluginId = alert.pluginId || alert.pluginid || ''

      // Infer vuln_type from name/CWE
      const vulnType = inferVulnType(name, String(cweid))

      // Clean HTML tags from desc/solution
      const cleanDesc = stripHtml(desc)
      const cleanSolution = stripHtml(solution)

      results.push({
        vuln_name: name,
        vuln_type: vulnType,
        severity: mapZapSeverity(riskcode),
        description: cleanDesc,
        remediation: cleanSolution,
        cvss_score: null,
        source: 'zap',
        source_id: pluginId ? String(pluginId) : undefined,
      })
    }
  }

  return deduplicate(results)
}

/**
 * 解析 Nmap XML 格式
 * @param {string} content
 * @returns {Array<{ vuln_name, vuln_type, severity, description }>}
 */
function parseNmapXml(content) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/xml')

  // Check for parse errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('XML 解析失败：无效的 Nmap XML 格式')
  }

  const results = []
  const hosts = doc.querySelectorAll('host')

  for (const host of hosts) {
    // Get host address
    const addrEl = host.querySelector('address[addrtype="ipv4"]')
    const hostAddr = addrEl?.getAttribute('addr') || 'unknown'

    const ports = host.querySelectorAll('ports > port')
    for (const port of ports) {
      const portId = port.getAttribute('portid') || ''
      const protocol = port.getAttribute('protocol') || 'tcp'

      // Service info
      const serviceEl = port.querySelector('service')
      const serviceName = serviceEl?.getAttribute('name') || 'unknown'
      const serviceProduct = serviceEl?.getAttribute('product') || ''
      const serviceVersion = serviceEl?.getAttribute('version') || ''

      // Scripts (vulnerabilities from NSE scripts)
      const scripts = port.querySelectorAll('script')
      for (const script of scripts) {
        const scriptId = script.getAttribute('id') || ''
        const scriptOutput = script.getAttribute('output') || ''

        // Only include scripts that look like vulnerability checks
        if (scriptId.includes('vuln') || scriptId.includes('ssl') ||
            scriptId.includes('exploit') || scriptOutput.toLowerCase().includes('vulnerable')) {
          results.push({
            vuln_name: `${serviceName}${serviceProduct ? ' (' + serviceProduct + ')' : ''} - ${scriptId}`,
            vuln_type: inferVulnType(scriptId, ''),
            severity: 'medium', // Nmap doesn't give severity; default to medium
            description: `${hostAddr}:${portId}/${protocol}\n${scriptOutput}`,
            remediation: '',
            cvss_score: null,
            source: 'nmap',
            source_id: `${hostAddr}:${portId}:${scriptId}`,
          })
        }
      }

      // Also report open ports with known-vulnerable services
      if (serviceProduct && isKnownVulnerable(serviceProduct, serviceVersion)) {
        results.push({
          vuln_name: `${serviceProduct} ${serviceVersion} 可能存在已知漏洞`,
          vuln_type: 'OUTDATED_SOFTWARE',
          severity: 'medium',
          description: `${hostAddr}:${portId}/${protocol} 运行 ${serviceProduct} ${serviceVersion}，该版本可能存在已知安全漏洞。`,
          remediation: `升级 ${serviceProduct} 到最新稳定版本`,
          cvss_score: null,
          source: 'nmap',
          source_id: `${hostAddr}:${portId}:outdated`,
        })
      }
    }
  }

  return deduplicate(results)
}

/**
 * 根据漏洞名称/CWE 推断漏洞类型
 */
function inferVulnType(name, cweid) {
  const lower = name.toLowerCase()
  if (lower.includes('sql') || lower.includes('injection') || cweid === '89') return 'SQLi'
  if (lower.includes('xss') || lower.includes('cross-site script') || cweid === '79') return 'XSS'
  if (lower.includes('ssrf') || cweid === '918') return 'SSRF'
  if (lower.includes('csrf') || lower.includes('cross-site request') || cweid === '352') return 'CSRF'
  if (lower.includes('rce') || lower.includes('remote code') || cweid === '94') return 'RCE'
  if (lower.includes('lfi') || lower.includes('local file') || lower.includes('path traversal') || cweid === '22') return 'LFI'
  if (lower.includes('xxe') || lower.includes('xml external') || cweid === '611') return 'XXE'
  if (lower.includes('redirect') || lower.includes('open redirect') || cweid === '601') return 'Open Redirect'
  if (lower.includes('auth') || lower.includes('session') || cweid === '287') return 'Auth'
  if (lower.includes('ssl') || lower.includes('tls') || lower.includes('certificate')) return 'SSL/TLS'
  if (lower.includes('info') || lower.includes('disclosure') || cweid === '200') return 'Info Disclosure'
  if (lower.includes('dos') || lower.includes('denial') || cweid === '400') return 'DoS'
  return 'OTHER'
}

/**
 * 检查是否为已知有漏洞的软件版本（简化版）
 */
function isKnownVulnerable(product, version) {
  const p = product.toLowerCase()
  // Very simplified check — in production, use CVE database
  const oldPatterns = [
    { product: 'apache', maxVersion: '2.4.49' },
    { product: 'nginx', maxVersion: '1.20.0' },
    { product: 'openssh', maxVersion: '8.0' },
    { product: 'php', maxVersion: '7.4.0' },
    { product: 'mysql', maxVersion: '5.7.0' },
    { product: 'tomcat', maxVersion: '9.0.50' },
    { product: 'iis', maxVersion: '10.0' },
  ]
  for (const pattern of oldPatterns) {
    if (p.includes(pattern.product) && version && compareVersions(version, pattern.maxVersion) < 0) {
      return true
    }
  }
  return false
}

/**
 * Simple version comparison
 */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na !== nb) return na - nb
  }
  return 0
}

/**
 * 去除 HTML 标签
 */
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 去重：同名 + 同源ID，保留 cvss_score 最高的条目
 */
function deduplicate(items) {
  const map = new Map()
  for (const item of items) {
    const key = `${item.vuln_name}|${item.source_id || ''}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, item)
    } else {
      // Keep the item with the higher cvss_score (null treated as -1)
      const existingScore = existing.cvss_score ?? -1
      const currentScore = item.cvss_score ?? -1
      if (currentScore > existingScore) {
        map.set(key, item)
      }
    }
  }
  return Array.from(map.values())
}

/**
 * 解析文件入口
 * @param {string} content - 文件文本内容
 * @returns {{ format: string, vulnerabilities: Array }}
 */
export function parseFile(content) {
  const format = detectFormat(content)

  if (format === 'zap-json') {
    return { format: 'ZAP JSON', vulnerabilities: parseZapJson(content) }
  }
  if (format === 'nmap-xml') {
    return { format: 'Nmap XML', vulnerabilities: parseNmapXml(content) }
  }

  throw new Error('不支持的文件格式，请上传 ZAP JSON 或 Nmap XML 文件')
}

export default parseFile
