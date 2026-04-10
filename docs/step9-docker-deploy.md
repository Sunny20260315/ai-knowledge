# Docker Compose 一键部署指南

## 架构概览

```
                    ┌─────────────────────────────────────┐
                    │         Docker Compose               │
                    │                                      │
  用户浏览器 ──────▶│  ┌──────────┐    ┌──────────┐       │
  http://localhost  │  │ frontend │───▶│ backend  │       │
       :3000        │  │ Next.js  │    │ NestJS   │       │
                    │  │ :3000    │    │ :3001    │       │
                    │  └──────────┘    └────┬─────┘       │
                    │                       │              │
                    │              ┌────────┼────────┐     │
                    │              ▼        ▼        │     │
                    │         ┌────────┐ ┌──────┐   │     │
                    │         │ChromaDB│ │SQLite│   │     │
                    │         │ :8000  │ │(文件) │   │     │
                    │         └────────┘ └──────┘   │     │
                    │                               │     │
                    │  ┌──────────┐                  │     │
                    │  │ Ollama   │ (宿主机或容器)    │     │
                    │  │ :11434   │                  │     │
                    │  └──────────┘                  │     │
                    └─────────────────────────────────────┘
```

## 需要创建的文件

项目根目录下创建以下文件：

```
ai-knowledge/
├── docker-compose.yml          # 编排所有服务
├── backend/
│   ├── Dockerfile              # 后端镜像
│   └── .env.docker             # Docker 环境变量
└── frontend/
    ├── Dockerfile              # 前端镜像
    └── .env.docker             # Docker 环境变量
```

---

## 1. docker-compose.yml（项目根目录）

```yaml
version: '3.8'

services:
  # ========== ChromaDB 向量数据库 ==========
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma  # 持久化向量数据
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=FALSE

  # ========== 后端 NestJS ==========
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    env_file:
      - ./backend/.env.docker
    volumes:
      - backend_db:/app/db              # 持久化 SQLite 数据库
      - backend_storage:/app/storage    # 持久化上传文件和临时文件
    depends_on:
      - chromadb
    restart: unless-stopped

  # ========== 前端 Next.js ==========
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_BASE=http://localhost:3001
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  chroma_data:      # ChromaDB 数据持久化
  backend_db:       # SQLite 数据库持久化
  backend_storage:  # 上传文件持久化
```

### 关键说明

| 配置项 | 说明 |
|--------|------|
| `volumes` | 三个命名卷保证容器重启后数据不丢失 |
| `depends_on` | 确保启动顺序：chromadb → backend → frontend |
| `restart: unless-stopped` | 崩溃后自动重启 |
| `NEXT_PUBLIC_API_BASE` | 构建时注入，告诉前端后端地址 |

---

## 2. backend/Dockerfile

```dockerfile
# ===== 阶段1：安装依赖 =====
FROM node:22-slim AS deps

# 安装 Python 和编译工具（better-sqlite3 需要 node-gyp 编译）
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./

# 安装 pnpm 并安装依赖
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# ===== 阶段2：构建 =====
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm build

# ===== 阶段3：运行 =====
FROM node:22-slim AS runner
WORKDIR /app

# better-sqlite3 需要原生模块，从 deps 阶段复制
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 创建存储目录
RUN mkdir -p /app/db /app/storage/temp /app/storage/history /app/storage/chroma

EXPOSE 3001
CMD ["node", "dist/main"]
```

### 关键说明

- **多阶段构建**：减小最终镜像体积
- **python3 + make + g++**：`better-sqlite3` 是 C++ 原生模块，需要编译工具（还记得之前踩的坑吗）
- **存储目录**：提前创建，避免运行时报错
- `pnpm-lock.yaml*` 中的 `*` 是因为如果项目根目录用 workspace，lock 文件可能在上层。如果你的 `pnpm-lock.yaml` 在根目录而不是 backend 里，需要调整 `context`

---

## 3. frontend/Dockerfile

```dockerfile
# ===== 阶段1：安装依赖 =====
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# ===== 阶段2：构建 =====
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建时注入 API 地址（从 docker-compose 的 build args 传入）
ARG NEXT_PUBLIC_API_BASE=http://localhost:3001
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm build

# ===== 阶段3：运行 =====
FROM node:22-slim AS runner
WORKDIR /app

# Next.js 需要的文件
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### 关键说明

- `NEXT_PUBLIC_API_BASE` 通过 `ARG` 在构建时注入（Next.js 的 `NEXT_PUBLIC_` 变量必须在构建时注入）
- 使用 Next.js **standalone** 输出模式（需要在 `next.config.ts` 中开启，见下方）
- 如果不用 standalone，也可以直接 `COPY --from=builder /app/.next ./.next` + `pnpm start`

### 需要修改：next.config.ts 开启 standalone

```typescript
// frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',  // ← 加这一行，Docker 部署必需
  allowedDevOrigins: ['192.168.31.229'],
};

export default nextConfig;
```

`output: 'standalone'` 会让 `next build` 生成一个独立的 `server.js`，不需要 `node_modules`，镜像更小。

---

## 4. backend/.env.docker

```env
# 服务器配置
PORT=3001
NODE_ENV=production

# 存储路径（容器内路径，配合 volumes 持久化）
TEMP_FILE_PATH=/app/storage/temp
HISTORY_FILE_PATH=/app/storage/history/history.json
CHROMA_DB_PATH=/app/storage/chroma

# AI 模型配置
# 方案A：Ollama 在宿主机运行（用 host.docker.internal 访问宿主机）
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
MODEL_NAME=deepseek-r1:7b
EMBEDDING_MODEL=nomic-embed-text

# 方案B：用云端 API（如硅基流动）
# OPENAI_API_KEY=sk-xxxxx
# OPENAI_BASE_URL=https://api.siliconflow.cn/v1
# MODEL_NAME=deepseek-ai/DeepSeek-V3
# EMBEDDING_MODEL=BAAI/bge-m3

# 数据库配置（容器内路径）
DATABASE_PATH=/app/db/knowledge.db

# ChromaDB 配置（Docker 网络内通过服务名访问）
CHROMA_HOST=http://chromadb:8000
```

### 关键说明

| 配置 | 开发环境 | Docker 环境 | 原因 |
|------|---------|------------|------|
| `CHROMA_HOST` | `localhost:8000` | `chromadb:8000` | Docker 网络内用服务名通信 |
| `OPENAI_BASE_URL` | `localhost:11434` | `host.docker.internal:11434` | 容器访问宿主机的 Ollama |
| `DATABASE_PATH` | `db/knowledge.db` | `/app/db/knowledge.db` | 容器内绝对路径 |
| 存储路径 | `./src/storage/...` | `/app/storage/...` | 容器内绝对路径 |

---

## 5. Ollama 的处理

Ollama 有两种部署方式：

### 方案 A：宿主机运行（推荐，简单）

Ollama 继续在宿主机运行，Docker 容器通过 `host.docker.internal` 访问。

```bash
# 宿主机上确保 Ollama 在运行
ollama serve

# 确保模型已拉取
ollama pull deepseek-r1:7b
ollama pull nomic-embed-text
```

macOS/Windows 的 Docker Desktop 默认支持 `host.docker.internal`。
Linux 需要在 docker-compose.yml 的 backend 服务中加：

```yaml
backend:
  extra_hosts:
    - "host.docker.internal:host-gateway"
```

### 方案 B：Ollama 也放进 Docker

```yaml
# 在 docker-compose.yml 中加一个服务
ollama:
  image: ollama/ollama:latest
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  # GPU 支持（NVIDIA 显卡，可选）
  # deploy:
  #   resources:
  #     reservations:
  #       devices:
  #         - capabilities: [gpu]

# volumes 中加
volumes:
  ollama_data:
```

然后 `.env.docker` 中改为：
```env
OPENAI_BASE_URL=http://ollama:11434/v1
```

注意：首次启动后需要进容器拉模型：
```bash
docker exec -it ai-knowledge-ollama-1 ollama pull deepseek-r1:7b
docker exec -it ai-knowledge-ollama-1 ollama pull nomic-embed-text
```

---

## 6. pnpm workspace 的处理

你的项目用的是 pnpm workspace（`pnpm-lock.yaml` 在根目录），但 Dockerfile 的 `context` 是子目录。有两种解决方式：

### 方案 A：每个子项目生成自己的 lock 文件（推荐）

```bash
# 在 backend 目录下生成独立的 lock 文件
cd backend && pnpm import  # 或 pnpm install 生成 pnpm-lock.yaml
cd ../frontend && pnpm import
```

### 方案 B：把 Docker context 设为根目录

修改 `docker-compose.yml`：

```yaml
backend:
  build:
    context: .                    # 根目录
    dockerfile: backend/Dockerfile
```

对应修改 Dockerfile 中的 COPY 路径：
```dockerfile
COPY backend/package.json ./
COPY pnpm-lock.yaml ./           # 根目录的 lock 文件
# ...
COPY backend/ .
```

---

## 7. 一键启动

```bash
# 1. 构建并启动所有服务
docker compose up -d --build

# 2. 查看日志
docker compose logs -f

# 3. 停止
docker compose down

# 4. 停止并清除数据（谨慎！）
docker compose down -v
```

启动后：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001
- Swagger 文档：http://localhost:3001/api
- ChromaDB：http://localhost:8000

---

## 8. 注意事项

### Puppeteer 的处理

你的 URL 解析用了 Puppeteer，它需要 Chrome 浏览器。在 Docker 中需要额外安装：

```dockerfile
# 在 backend/Dockerfile 的 runner 阶段加
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-wqy-zenhei \        # 中文字体支持
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

或者如果不需要 URL 解析功能，可以在 Docker 部署时跳过。

### .dockerignore

在 `backend/` 和 `frontend/` 下各创建 `.dockerignore`：

```
node_modules
dist
.next
.env
.env.local
*.log
```

避免把本地的 `node_modules` 复制进镜像（会导致原生模块不兼容）。

### 数据备份

SQLite 数据库和 ChromaDB 数据都在 Docker volumes 中：

```bash
# 查看 volumes
docker volume ls

# 备份 SQLite 数据库
docker cp ai-knowledge-backend-1:/app/db/knowledge.db ./backup/

# 备份整个 volume
docker run --rm -v ai-knowledge_backend_db:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data
```

---

## 9. 完整文件清单

实现一键部署，你需要创建/修改这些文件：

| 文件 | 操作 | 说明 |
|------|------|------|
| `docker-compose.yml` | 新建 | 服务编排 |
| `backend/Dockerfile` | 新建 | 后端镜像 |
| `backend/.env.docker` | 新建 | Docker 环境变量 |
| `backend/.dockerignore` | 新建 | 排除不需要的文件 |
| `frontend/Dockerfile` | 新建 | 前端镜像 |
| `frontend/.dockerignore` | 新建 | 排除不需要的文件 |
| `frontend/next.config.ts` | 修改 | 加 `output: 'standalone'` |

按文档中的内容逐个创建即可，最后 `docker compose up -d --build` 一键启动。
