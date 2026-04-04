# AI 本地知识库 - 项目开发计划

## 产品目标

本地部署的私有化知识库工具：上传文档 → AI 解析入库 → 基于文档内容精准问答。数据不上云。

## 现状评估

### 已完成

- NestJS 项目骨架搭建
- 4 个模块的基础 CRUD（knowledge-base / document / chat / search）
- 数据库连接（TypeORM + better-sqlite3）
- Swagger 文档配置
- Winston 日志系统
- 环境变量配置（ConfigModule）

### 未完成（核心功能全部缺失）

- 文件上传接口
- 文档解析（PDF / Word / Markdown / TXT）
- 文本切片（Chunking）
- 向量化嵌入（Embedding）
- ChromaDB 向量存储
- RAG 检索增强生成
- AI 对话（LLM 调用 + 流式输出）
- 语义搜索
- 前端页面
- 数据持久化（当前用 `:memory:` 内存数据库，重启丢数据）

### 已安装但未使用的依赖

| 包名 | 用途 | 状态 |
|------|------|------|
| `langchain` | RAG 框架 | 未使用 |
| `@langchain/openai` | OpenAI 模型接入 | 未使用 |
| `@langchain/community` | 社区集成 | 未使用 |
| `chromadb` | 向量数据库 | 未使用 |
| `pdf-parse` | PDF 解析 | 未使用 |
| `mammoth` | Word 解析 | 未使用 |
| `marked` | Markdown 解析 | 未使用 |
| `multer` | 文件上传 | 未使用 |

---

## 开发计划

### 阶段零：修复基础设施（预计 1-2 小时）

> 目标：让现有代码能正常跑，数据不丢失

- [ ] **数据库持久化**：`:memory:` → 文件路径（`db/knowledge.db` 等），重启后数据不丢
- [ ] **合并数据库**：当前 5 个独立 SQLite 库没必要，合并为 1 个
- [ ] **修复 Swagger 注释**：document controller 的 PATCH/DELETE 描述写反了
- [ ] **补全 remove 方法**：document service 的 remove 还是占位字符串

---

### 阶段一：文档上传与解析（核心链路上半段）

> 目标：用户能上传文件，系统自动解析文本、切片、存入向量库

#### 1.1 文件上传接口

```
POST /documents/upload
Content-Type: multipart/form-data
Body: file + knowledgeBaseId
```

- [ ] 配置 Multer 文件上传中间件
- [ ] 支持格式校验（PDF / TXT / MD / DOCX）
- [ ] 文件大小限制（50MB）
- [ ] 文件保存到 `storage/temp/` 临时目录

#### 1.2 文档解析服务

- [ ] 实现 `file.util.ts`，根据文件类型调用不同解析器：
  - PDF → `pdf-parse`
  - Word → `mammoth`
  - Markdown → `marked`（转纯文本）
  - TXT → 直接读取
- [ ] 提取纯文本内容

#### 1.3 文本切片（Chunking）

- [ ] 使用 LangChain 的 `RecursiveCharacterTextSplitter`
- [ ] 配置切片参数（chunkSize: 1000, overlap: 200）
- [ ] 记录切片数量到 document_parse 表

#### 1.4 向量化 + 存入 ChromaDB

- [ ] 实现 `langchain.config.ts`，配置 OpenAI Embedding 模型
- [ ] 创建 ChromaDB 客户端连接
- [ ] 将切片文本向量化后存入 ChromaDB collection
- [ ] 每个知识库对应一个 collection

#### 1.5 完整上传流程串联

```
用户上传文件
  → Multer 接收保存
    → 解析器提取文本
      → 切片器切分
        → Embedding 向量化
          → 存入 ChromaDB
            → 更新 document_parse 表状态
```

- [ ] 上传状态管理（uploading → parsing → embedding → done / failed）
- [ ] 错误处理和失败重试

---

### 阶段二：语义搜索（核心链路验证）

> 目标：能根据关键词在知识库中搜索到相关文档片段

```
GET /search?q=xxx&knowledgeBaseId=xxx
```

- [ ] 将查询文本向量化
- [ ] 在 ChromaDB 中执行相似度搜索
- [ ] 返回 Top-K 相关片段（含原文、相似度分数、来源文档）
- [ ] 支持按知识库筛选

**验证点**：上传一个文档后，能搜到相关内容 = 阶段一 + 阶段二跑通。

---

### 阶段三：AI 对话（核心链路下半段）

> 目标：基于知识库内容进行 RAG 问答

#### 3.1 对话消息接口

```
POST /chat/message
Body: { sessionId?, content, knowledgeBaseId }
Response: SSE 流式输出
```

- [ ] 新增 `POST /chat/message` 接口（使用已有的 `SendChatMessageDto`）
- [ ] 会话管理：无 sessionId 时自动创建新会话

#### 3.2 RAG 检索 + 生成

- [ ] 用户提问 → 向量化 → ChromaDB 相似度检索
- [ ] 取 Top-K 片段作为上下文
- [ ] 构造 Prompt：系统指令 + 上下文片段 + 用户问题
- [ ] 调用 LLM（OpenAI / DeepSeek / 通义千问）生成回答

#### 3.3 流式输出（SSE）

- [ ] 使用 Server-Sent Events 实现逐字输出
- [ ] NestJS 中通过 `@Sse()` 装饰器或手动设置 Response header

#### 3.4 对话历史

- [ ] 消息存入 chat_message 表
- [ ] 支持多轮对话上下文（取最近 N 条消息作为 history）
- [ ] 引用溯源：回答中标注引用了哪些文档片段

---

### 阶段四：前端页面

> 目标：提供可用的 Web 界面

技术栈建议：Next.js / React + TailwindCSS

- [ ] **左侧面板**：知识库列表 + 文件上传区
- [ ] **右侧面板**：对话窗口（消息列表 + 输入框）
- [ ] **文件上传**：拖拽上传 + 进度条 + 状态显示
- [ ] **流式对话**：逐字显示 AI 回答（SSE 消费）
- [ ] **知识库管理**：创建 / 切换 / 删除知识库

---

### 阶段五：完善与优化

- [ ] 数据库从 SQLite 迁移到持久化方案（可选 PostgreSQL）
- [ ] 支持多模型切换（OpenAI / DeepSeek / 通义千问 / 本地 Ollama）
- [ ] 对话导出（TXT / Markdown）
- [ ] 文档管理（列表、删除文档及其向量）
- [ ] 密码登录（简单权限控制）
- [ ] 错误处理和日志完善

---

## 开发顺序和依赖关系

```
阶段零（基础修复）
  │
  ▼
阶段一（文档上传与解析） ← 这是整个系统的基础
  │
  ▼
阶段二（语义搜索） ← 验证阶段一的成果
  │
  ▼
阶段三（AI 对话） ← 依赖阶段二的检索能力
  │
  ▼
阶段四（前端页面） ← 依赖后端 API 就绪
  │
  ▼
阶段五（完善优化） ← 锦上添花
```

## 关键技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 向量数据库 | ChromaDB | 已安装，轻量级，适合本地部署 |
| RAG 框架 | LangChain | 已安装，生态成熟，文档丰富 |
| Embedding 模型 | OpenAI text-embedding-ada-002 | .env 已配置，后续可换本地模型 |
| LLM | OpenAI GPT-3.5（默认） | .env 已配置，支持切换 |
| 文件数据库 | SQLite（持久化文件） | 本地部署，够用，无需 PostgreSQL |
| 前端 | Next.js + TailwindCSS | 待定，可根据你的偏好调整 |
