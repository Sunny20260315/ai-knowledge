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