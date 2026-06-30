# ============================================================
# 前端 Dockerfile — 多阶段构建
# 阶段 1: 构建 (Node.js 20 Alpine)
# 阶段 2: 运行 (Nginx Alpine)
# ============================================================

# ---- 构建阶段 ----
FROM node:20-alpine AS build

WORKDIR /app

# 依赖安装（利用 Docker 缓存层）
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --only=production --ignore-scripts 2>/dev/null || npm install

# 复制源码并构建
COPY frontend/ .
RUN npm run build

# ---- 运行阶段 ----
FROM nginx:1.25-alpine

# 删除默认 Nginx 配置
RUN rm -f /etc/nginx/conf.d/default.conf

# 拷贝自定义 Nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝构建产物
COPY --from=build /app/dist /usr/share/nginx/html

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
