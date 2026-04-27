# ai-knowledge-agent

一个支持 **多知识库管理 + RAG + AI Agent + 私有化部署** 的智能知识助手平台。  
可用于企业内部知识管理、个人学习系统、AI SaaS 产品原型。

## ✨ 项目亮点（核心卖点）

- 🔍 **RAG（Retrieval-Augmented Generation）**
  - 文档解析 → 切片 → 向量化 → 语义检索 → LLM生成
- 🤖 **AI Agent 能力（支持工具调用）**
  - 支持 Function Calling
  - 可扩展搜索 / 计算 / 外部 API
- 🧩 **多知识库隔离（SaaS 架构）**
  - 支持不同知识库分类管理
- 🧠 **语义搜索（Embedding + Vector DB）**
  - 基于 ChromaDB 实现高效检索
- 🔐 **支持私有化部署**
  - 可接入本地模型（如 Ollama）
- 💬 **上下文对话（Chat Memory）**
  - 支持历史记录与多轮对话
- 🌐 **（可扩展）Web3 钱包登录**
  - 支持签名登录，实现去中心化身份

## 📦 核心功能：

Module 1: Document（文档管理）

- POST /documents/upload — 上传文件，解析 → 切片 → 向量化 → 存入 ChromaDB
- GET /documents — 列表（支持分页、按知识库筛选）
- GET /documents/:id — 详情
- DELETE /documents/:id — 删除文档及其向量

Module 2: Knowledge Base（知识库分类）

- POST /knowledge-bases — 创建知识库（如「前端笔记」「AI 论文」）
- GET /knowledge-bases — 列表
- PUT /knowledge-bases/:id — 编辑
- DELETE /knowledge-bases/:id — 删除

Module 3: Chat（AI 对话）

- POST /chat — 发送问题，基于知识库 RAG 回答
- GET /chat/history — 对话历史
- DELETE /chat/history/:id — 删除对话

Module 4: Search（语义搜索）

- GET /search?q=xxx\&kb=xxx — 跨文档语义搜索

<br />

## 技术架构

```bash
Frontend: Next.js / React
Backend: Node.js (NestJS)
LLM: OpenAI / 本地模型（Ollama）
Vector DB: ChromaDB
Embedding: OpenAI Embedding
Storage: 本地文件 / 可扩展 S3
```

## 核心流程

```
上传文档
   ↓
文本解析（PDF / Markdown / TXT）
   ↓
文本切片（Chunking）
   ↓
向量化（Embedding）
   ↓
存入 ChromaDB
   ↓
用户提问
   ↓
语义检索（Top-K）
   ↓
构建 Prompt
   ↓
LLM 生成答案
```

## swagger 链接：

## [Swagger UI 的默认地址是：http://localhost:3000/api](http://localhost:3000/api)

## 待办清单

- [ ] **多知识库隔离**：
  - 支持不同知识库分类管理，每个知识库有独立的文档和向量存储。
- [ ] **支持私有化部署**：
  - 可接入本地模型（如 Ollama），实现私有化部署。
- [ ] **上下文对话（Chat Memory）**：
  - 支持历史记录与多轮对话，保持上下文信息。
  - 对话历史管理（支持删除）
- [ ] **（可扩展）Web3 钱包登录**：
  - 支持签名登录，实现去中心化身份。
  - 支持自定义用户角色，如管理员、用户、 guest 等。
  - 支持用户权限管理，如创建知识库、上传文档、查看文档等。
  - 支持用户角色权限管理，如管理员可以创建知识库、删除知识库，普通用户只能查看文档。
- [ ] **（可扩展）AI Agent 能力**：
  - 支持 Function Calling
  - 可扩展搜索 / 计算 / 外部 API
  - 支持自定义函数，如「调用外部 API」、「执行计算」等。
- [ ] **支持指定知识库搜索**：
  - 支持用户在指定知识库内进行搜索，避免跨知识库搜索。
- [ ] **多模型支持**：
  - 支持用户在不同模型之间切换，如 OpenAI、Ollama 等。
- [ ] **多用户系统**：
  - 支持多个用户同时使用，每个用户有自己的知识库和权限。
