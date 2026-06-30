# 性能基准与预期指标

> Sprint 7 — 性能优化验收标准

## 关键性能指标

| 指标 | 目标值 | 测试条件 | 验收方法 |
|------|--------|----------|----------|
| **图表渲染** | ≤500ms | 1000 条漏洞数据 | Chrome DevTools Performance 面板 |
| **列表渲染** | ≤200ms | 1000 条漏洞数据 | Chrome DevTools Performance 面板 |
| **首屏加载** | ≤2s | 生产构建，首次访问 | Lighthouse / Web Vitals |
| **虚拟滚动** | 无卡顿 | 5000+ 条漏洞列表 | 滚动帧率 ≥55fps |
| **图表 resize** | ≤100ms | 浏览器窗口/标签切换 | 手动验证 |
| **API 重试** | 自动恢复 | 模拟 500/网络断开 | 3 次指数退避 1s→2s→4s |

## 优化措施

### T7.1 — ErrorBoundary 全覆盖
- 每个核心组件独立 ErrorBoundary，单组件崩溃不影响全局
- 子图表（Pie/Bar/Radar/Trend）独立容错
- Fallback: Card + "组件加载失败" + 重试按钮

### T7.2 — 图表懒加载
- IntersectionObserver 监听图表容器进入视口
- rootMargin: 200px 提前加载
- 进入前显示 ChartSkeleton 骨架屏
- 4 个图表独立触发

### T7.3 — 虚拟滚动
- react-window FixedSizeList
- 行高 80px，容器最大 500px
- 支持 5000+ 条无卡顿
- overscan 5 行保证滚动流畅

### T7.4 — 图表 resize 修复
- ResizeObserver 监听容器尺寸变化
- visibilitychange 修复标签页切换后尺寸塌陷
- layout:resize 事件通知图表重新适配
- window resize 事件兜底

### T7.5 — 布局自适应
- xs/sm: 单列堆叠
- md: 图表两列
- lg+: 双栏/三栏
- 三栏模式 grid 在 md 断点降级为双列

### T7.6 — API 重试机制
- apiClient 封装 fetch
- 失败自动重试 3 次
- 指数退避：1s → 2s → 4s
- 超时 60s（批量 120s）
- 500/502/503/504 触发重试
- 外部 AbortSignal 优先

### T7.7 — 全局 Notification
- Ant Design notification.useNotification
- 错误/成功/警告统一持久显示
- analysisSlice reject 时自动弹出错误通知

## 测试建议

### 手动测试清单

1. **图表渲染**: 上传 1000+ 条 ZAP/Nmap 报告，观察图表绘制耗时
2. **列表滚动**: 5000+ 条漏洞列表，验证滚动流畅度
3. **ErrorBoundary**: React DevTools 手动 throw 错误，验证组件降级
4. **懒加载**: 滚动到图表区域前应显示骨架屏
5. **resize**: 切换布局/缩放窗口/切标签页后图表应正确适配
6. **API 重试**: 断网后恢复，验证自动重连
7. **中文 PDF**: 生成 PDF 报告验证中文渲染

### 自动化测试（建议后续补充）

```bash
# Lighthouse CI
npx lighthouse http://localhost:5173 --output html --output-path ./lighthouse-report.html

# Bundle 分析
npx vite-bundle-visualizer
```
