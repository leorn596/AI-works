# Sprint 1 代码规范审查

> 审查日期: 2026-06-30 | 审查人: QA Agent (robot01)  
> 范围: 前端 ESLint/Prettier + 后端 Black/isort/flake8 + API 格式一致性  
> 状态: 设计阶段预审 — 待代码落地后复查

---

## [STD-01] 前端 ESLint 配置审查

### 必须项 (MUST)
| # | 规则 | 配置预期 | 依据 |
|---|------|---------|------|
| 1 | 使用 TypeScript | `@typescript-eslint/parser` | 技术栈确认使用 TS |
| 2 | React Hooks 规则 | `eslint-plugin-react-hooks` | React 18 最佳实践 |
| 3 | 禁止 `any` 类型 | `"@typescript-eslint/no-explicit-any": "warn"` | 类型安全 |
| 4 | 未使用变量 | `"@typescript-eslint/no-unused-vars": "error"` | 代码清洁 |
| 5 | Import 排序 | `eslint-plugin-import` 或 `simple-import-sort` | 可读性 |

### 建议项 (SHOULD)
| # | 规则 | 配置预期 |
|---|------|---------|
| 1 | Prettier 集成 | `eslint-config-prettier` 避免冲突 |
| 2 | 禁止 `console.log` 残留 | `"no-console": "warn"` |
| 3 | 组件定义方式 | 优先 `const Component: React.FC<Props> = () => {}` |
| 4 | 文件命名 | PascalCase 组件 / camelCase 工具函数 |

### 推荐配置模板 (.eslintrc.cjs)
```javascript
module.exports = {
  root: true,
  env: { browser: true, es2023: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh', '@typescript-eslint', 'simple-import-sort'],
  rules: {
    'react-refresh/only-export-components': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
  },
  settings: { react: { version: 'detect' } },
};
```

---

## [STD-02] 前端 Prettier 配置审查

### 推荐配置模板 (.prettierrc)
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true
}
```

### 验收检查清单
```
[ ] .eslintrc.cjs 或 eslint.config.js 存在
[ ] .prettierrc 或 prettier.config.js 存在
[ ] package.json scripts 包含 "lint": "eslint ." 和 "format": "prettier --write ."
[ ] eslint-config-prettier 安装并引用（避免与 Prettier 冲突）
[ ] VS Code 推荐扩展配置在 .vscode/extensions.json 中
```

---

## [STD-03] 后端 Black 配置审查

### 推荐配置 (pyproject.toml)
```toml
[tool.black]
line-length = 100
target-version = ['py311']
include = '\.pyi?$'
extend-exclude = '''
/(
    \.eggs
  | \.git
  | \.venv
  | __pycache__
  | migrations
)/
'''
```

### 验收检查清单
```
[ ] pyproject.toml 包含 [tool.black] 配置段
[ ] requirements.txt 或 dev-requirements 包含 black
[ ] Makefile 或 scripts 包含 format/lint 命令
```

---

## [STD-04] 后端 isort 配置审查

### 推荐配置 (pyproject.toml 合并)
```toml
[tool.isort]
profile = "black"
line_length = 100
known_first_party = ["app", "api", "models", "schemas", "services"]
```

### 验收检查清单
```
[ ] pyproject.toml 包含 [tool.isort] 配置段
[ ] isort 与 Black 兼容（profile = "black"）
[ ] requirements.txt 或 dev-requirements 包含 isort
```

---

## [STD-05] 后端 flake8 / Ruff 配置审查

### 推荐配置 (pyproject.toml 合并)
```toml
[tool.ruff]
line-length = 100
target-version = "py311"
exclude = ["migrations", ".venv", "__pycache__"]

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B"]
ignore = ["E501"]  # line-too-long 由 Black 处理
```

> **备注:** 推荐使用 Ruff 替代 flake8（更快，配置统一），Sprint 1 不做强制。

---

## [STD-06] API 统一返回格式一致性

### 标准格式
```json
{
  "code": 200,
  "message": "ok",
  "data": { ... }
}
```

### 状态码约定
| 场景 | code | message |
|------|------|---------|
| 成功 | 200 | "ok" |
| 参数校验失败 | 400 | "请求参数错误: {具体字段}" |
| 资源不存在 | 404 | "资源未找到" |
| 服务器错误 | 500 | "服务器内部错误" |
| AI 服务不可用 | 503 | "AI 服务暂时不可用" |
| AI 分析超时 | 504 | "AI 分析超时" |

### 实现检查
```
[ ] 所有端点使用统一的 response_model 或 BaseModel
[ ] 存在全局异常处理器（Exception Handler）统一格式化错误返回
[ ] 前后端 code 约定一致（前端根据 code 判断成功/失败）
[ ] data 字段：成功时为对象/数组，失败时为 null
[ ] 不将原始异常堆栈放入 message
```

### 后端推荐实现模式
```python
# schemas/response.py
from pydantic import BaseModel
from typing import Any, Optional

class APIResponse(BaseModel):
    code: int = 200
    message: str = "ok"
    data: Optional[Any] = None

# main.py — 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务器内部错误", "data": None}
    )
```

### 前端推荐处理模式
```typescript
// api/client.ts
interface APIResponse<T> {
  code: number;
  message: string;
  data: T;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body: APIResponse<T> = await res.json();
  if (body.code !== 200) {
    throw new ApiError(body.code, body.message);
  }
  return body.data;
}
```

---

## 审查汇总

| 标准项 | 状态 | 待验证 |
|--------|------|--------|
| STD-01 ESLint | ⚠️ 配置模板已提供 | 代码落地后验证 |
| STD-02 Prettier | ⚠️ 配置模板已提供 | 代码落地后验证 |
| STD-03 Black | ⚠️ 配置模板已提供 | 代码落地后验证 |
| STD-04 isort | ⚠️ 配置模板已提供 | 代码落地后验证 |
| STD-05 Ruff/flake8 | ⚠️ 推荐 Ruff | 代码落地后验证 |
| STD-06 API 格式 | ✅ 规范已定义 | 所有端点返回一致性 |

> **结论:** 规范设计完成，推荐配置已就绪。代码落地后逐项对照验收。
