# Sprint 2 安全审查清单

> 审查日期: 2026-06-30 | 审查人: QA & Security Agent (robot01)  
> 范围: US-09 ~ US-16 (图表 + 文件上传 + 响应式)  
> 状态: 设计阶段预审 — 待代码落地后复查

---

## [SEC-2-01] 文件上传安全

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | 文件类型白名单 | 仅允许 `.json` 和 `.xml` | 🔴 Critical |
| 2 | MIME 类型双重校验 | 前端 `File.type` + 后端 `Content-Type` + magic bytes | 🔴 Critical |
| 3 | 文件大小限制 | 前端 ≤ 10MB，后端 ≤ 10MB | 🔴 Critical |
| 4 | 文件不保存到磁盘 | 仅内存处理 (`await file.read()`)，无 `file.save()` | 🔴 Critical |
| 5 | 文件名安全处理 | 清理路径遍历字符 (`../`) 和特殊字符 | ⚠️ High |
| 6 | 上传速率限制 | 单 IP 限制上传频率，防止 DoS | ⚠️ High |
| 7 | 前端绕过防护 | 后端独立校验文件类型、大小，不依赖前端 | 🔴 Critical |

### 预期实现模式

```python
# 后端: 安全的文件接收示例
from fastapi import UploadFile, File, HTTPException

ALLOWED_CONTENT_TYPES = {
    "application/json",
    "text/xml",
    "application/xml",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("/analyze/batch")
async def analyze_batch(file: UploadFile = File(...)):
    # 1. 校验 Content-Type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, "仅支持 JSON/XML 格式文件")
    
    # 2. 读取到内存（不存盘）
    contents = await file.read()
    
    # 3. 校验大小
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "文件大小不能超过 10MB")
    
    # 4. 校验文件扩展名
    filename = file.filename or ""
    if not filename.lower().endswith(('.json', '.xml')):
        raise HTTPException(400, "仅支持 .json / .xml 文件")
    
    # 5. 内存中解析（json.loads / defusedxml）
    # ...
```

### 验收检查清单
```
[ ] 前端 Upload accept=".json,.xml" 或 beforeUpload 校验
[ ] 前端 beforeUpload 校验文件大小 ≤ 10MB
[ ] 后端 File.content_type 校验
[ ] 后端 file.read() 后检查 len(contents) ≤ 10MB
[ ] 后端无 file.save() / open('wb') / shutil.copyfileobj 等磁盘写入
[ ] 上传后检查 /tmp 无残留文件
[ ] 无路径遍历漏洞（文件名不用于构建文件路径）
[ ] UploadFile 不使用临时文件存储（使用内存 SpooledTemporaryFile）
```

---

## [SEC-2-02] XML 解析安全 — XXE 防护

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | 禁止外部实体 | `resolve_entities=False` 或使用 `defusedxml` | 🔴 Critical |
| 2 | 禁止 DTD | 完全禁用 DTD 解析 | 🔴 Critical |
| 3 | 实体扩展限制 | 限制实体递归深度和数量（Billion Laughs 攻击） | 🔴 Critical |
| 4 | 大文档保护 | 限制解析的 XML 节点总数和深度 | ⚠️ High |
| 5 | 前端解析安全性 | 浏览器 DOMParser 天然安全但有沙箱限制 | Low |

### 预期实现模式 — 后端

```python
# ✅ 推荐: defusedxml (最安全)
import defusedxml.ElementTree as ET
tree = ET.fromstring(xml_content)

# ✅ 可用: lxml 安全配置
from lxml import etree
parser = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    dtd_validation=False,
    load_dtd=False,
    huge_tree=False,
)
tree = etree.fromstring(xml_content, parser)

# ❌ 禁止: 默认 xml.etree.ElementTree (无 XXE 防护)
import xml.etree.ElementTree as ET  # DON'T USE
```

### 预期实现模式 — 前端

```javascript
// ✅ 推荐: fast-xml-parser (安全配置)
import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    processEntities: false,    // 关键: 不处理实体
    htmlEntities: false,        // 关键: 不处理 HTML 实体
    allowBooleanAttributes: true,
});
const result = parser.parse(xmlString);
```

### XXE 攻击载荷测试样本

```xml
<!-- 必须被拒绝的 XXE payload -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<nmaprun>&xxe;</nmaprun>

<!-- 必须被拒绝的 Billion Laughs 攻击 -->
<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  ...
]>
<nmaprun>&lol9;</nmaprun>
```

### 验收检查清单
```
[ ] 后端使用 defusedxml 或 lxml（禁用外部实体）
[ ] 后端无 `import xml.etree.ElementTree` 直接使用
[ ] 前端 XML 解析器设置 processEntities: false
[ ] XXE payload 测试：不返回 /etc/passwd 内容
[ ] Billion Laughs 测试：不 OOM，解析失败或超时
[ ] 禁用 DTD 解析
[ ] XML 解析有超时限制
```

---

## [SEC-2-03] /api/analyze/batch 端点速率限制

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | 速率限制实现 | 每 IP 或 session 限制 req/min | 🔴 Critical |
| 2 | 限制阈值 | 建议 10 req/min（AI API 消耗成本 + 服务器负载） | ⚠️ High |
| 3 | 存储后端 | 使用 Redis 存储计数器（分布式安全） | Medium |
| 4 | 响应格式 | HTTP 429 + `Retry-After` 头 + 统一 JSON body | Medium |
| 5 | 限流绕过防护 | X-Forwarded-For 信任配置正确 | ⚠️ High |

### 预期实现模式

```python
# 使用 slowapi 或自定义 Redis-based 限流
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])

@app.post("/api/analyze/batch")
@limiter.limit("5/minute")  # 更严格的上传+分析限流
async def analyze_batch(file: UploadFile = File(...)):
    ...
```

### 若使用自定义 Redis 限流：

```python
import redis.asyncio as redis

async def check_rate_limit(client_ip: str, limit: int = 10, window: int = 60):
    r = redis.from_url(settings.REDIS_URL)
    key = f"ratelimit:analyze_batch:{client_ip}"
    current = await r.incr(key)
    if current == 1:
        await r.expire(key, window)
    if current > limit:
        raise HTTPException(429, "请求过于频繁，请稍后再试")
```

### 验收检查清单
```
[ ] /api/analyze/batch 有速率限制（建议 5-10 req/min）
[ ] 速率限制通过 Redis 实现（支持多实例）
[ ] 超过限制返回 HTTP 429 + Retry-After 头
[ ] 响应体格式统一为 {code: 429, message: "...", data: null}
[ ] 限流基于客户端 IP（正确使用 X-Forwarded-For）
[ ] 其他 POST 端点（如 /api/analyze/manual）也有速率限制
[ ] Redis 不可用时降级为保守策略（拒绝/通过取决于业务需求）
```

---

## [SEC-2-04] 前端 XSS 防护 — 图表注入

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | 图表 label/tooltip 内容安全 | 漏洞名称/类型等字段必须 HTML 转义 | ⚠️ High |
| 2 | 文件名字段展示安全 | 上传文件名展示时 HTML 转义 | ⚠️ High |
| 3 | ECharts rich text formatter | 禁止使用自定义 HTML formatter 渲染原始数据 | Medium |

### 验收检查清单
```
[ ] ECharts tooltip formatter 使用纯文本或限制 HTML
[ ] 文件名/漏洞名在展示前经过 React JSX 转义
[ ] 无 dangerouslySetInnerHTML 在图表相关组件中
[ ] 无 eval() / new Function() 处理图表数据
```

---

## [SEC-2-05] 新增依赖安全性

### 审查项
| # | 依赖 | 用途 | 安全关注点 |
|---|------|------|-----------|
| 1 | echarts@^6.1.0 | 图表库 | 已知 CVE？版本是否最新？ |
| 2 | echarts-for-react@^3.0.6 | React 封装 | npm audit 结果 |
| 3 | fast-xml-parser (新增) | 前端 XML 解析 | 默认安全配置 |
| 4 | defusedxml (新增) | 后端 XXE 安全 | 无已知漏洞 |
| 5 | slowapi (建议新增) | 速率限制 | 依赖树健康度 |
| 6 | antd Upload 组件 | 文件上传 | 组件安全（依赖 antd 版本） |

### 验收检查清单
```
[ ] npm audit 无 Critical/High 漏洞
[ ] pip-audit 无已知 CVE
[ ] fast-xml-parser 配置 processEntities: false
[ ] defusedxml 被正确引入
[ ] slowapi 或等价限流库被引入
[ ] 所有新增依赖锁定了最小版本号
[ ] package.json 中 unlock 版本范围是否合理（^/~ 前缀）
```

---

## [SEC-2-06] 图表数据安全

### 审查项
| # | 检查点 | 要求 | 风险等级 |
|---|--------|------|---------|
| 1 | 图表数据来源 | 数据来自已验证的后端响应，无用户可控注入 | Medium |
| 2 | 图表 click 事件回传 | 回调函数不执行 eval 或动态代码 | Low |
| 3 | 图表 option 序列化 | setOption 的数据不包含可执行代码 | Low |

### 验收检查清单
```
[ ] 图表数据通过 Redux state 传递，不直接从 URL/queryString 读取
[ ] onClick 回调仅触发 dispatch/路由跳转，无 eval
[ ] 无用户输入直接影响 ECharts option 结构（如 inject custom series）
```

---

## [SEC-2-07] 环境变量/配置新增项审查

### Sprint 2 可能需要的新环境变量

| 变量名 | 用途 | 默认值 | 必须 |
|--------|------|--------|------|
| `MAX_UPLOAD_SIZE_MB` | 文件上传大小限制 | 10 | No |
| `RATE_LIMIT_ANALYZE_PER_MIN` | 分析端点速率限制 | 10 | No |
| `RATE_LIMIT_UPLOAD_PER_MIN` | 上传端点速率限制 | 5 | No |
| `XML_PARSE_TIMEOUT_SEC` | XML 解析超时 | 30 | No |
| `TEMP_FILE_CLEANUP_ENABLED` | 临时文件清理开关 | true | No |

### 验收检查清单
```
[ ] 新环境变量在 docker/.env.template 中有文档说明
[ ] 新环境变量有合理的默认值
[ ] 新环境变量未硬编码
[ ] 新环境变量不在日志中打印
[ ] docker-compose.yml 中 backend service 的 environment 块已更新
```

---

## 汇总

| 审查项 | 状态 | 风险 |
|--------|------|------|
| SEC-2-01 文件上传安全 | ⚠️ 设计合规，待代码验证 | 🔴 Critical |
| SEC-2-02 XML 解析 XXE 防护 | ⚠️ 设计合规，待代码验证 | 🔴 Critical |
| SEC-2-03 /api/analyze/batch 速率限制 | ⚠️ 需新增 slowapi/redis 限流 | 🔴 Critical |
| SEC-2-04 前端图表 XSS 防护 | ✅ 设计安全（React 默认转义） | Medium |
| SEC-2-05 新增依赖安全性 | ⚠️ 待依赖明确后 audit | Medium |
| SEC-2-06 图表数据安全 | ✅ 设计合规 | Low |
| SEC-2-07 环境变量更新 | ⚠️ 待代码落地后确认 | Low |

> **总体结论:** 设计层面无明显阻塞。代码落地后必须重点复查 SEC-2-01（文件上传安全）、SEC-2-02（XXE 防护）、SEC-2-03（速率限制）。这三个为 🔴 Critical 风险项。

---

*报告结束 — robot01 QA & Security & DevOps Agent*
