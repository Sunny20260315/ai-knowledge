# 小册子大纲

## 书名候选

| 方案 | 书名 | 风格 |
|------|------|------|
| **A（推荐）** | **《前端人的 AI 全栈之路：从零构建私有知识库》** | 精准定位读者 + 项目驱动 |
| B | 《NestJS + RAG 实战：前端工程师的全栈进化》 | 技术关键词突出 |
| C | 《AI 时代的全栈开发：一个项目带你打通前后端》 | 强调时代感 + 项目制 |
| D | 《从前端到全栈：用 AI 知识库项目打通任督二脉》 | 轻松口语化 |
| E | 《手把手带你做 AI 知识库：前端转全栈实战指南》 | 直白务实 |

**副标题**：NestJS + Next.js + RAG + 向量数据库，一个项目搞定全栈 + AI

---

## 读者画像

- 1-5 年前端开发，想转全栈但不知道从哪入手
- 听过 RAG / 向量数据库 / LLM，但没实际用过
- 熟悉 React / TypeScript，对 Node.js 有基础了解
- 想做一个完整的 AI 项目写进简历

## 小册子定位

**不是**一本 NestJS 入门书，**不是**一本 AI 原理书。
**是**一本"前端工程师用已有技能，构建一个完整 AI 全栈项目"的实战手册。

核心理念：**用一个项目串联所有知识点，每一章都有可运行的成果。**

---

## 大纲

### 开篇

#### 第 0 章：写在前面 —— 前端为什么要学全栈？

- 前端的天花板在哪里
- AI 时代对前端的影响：不只是调 API，而是理解整个链路
- 这本小册你会收获什么（技术栈全景图）
- 我们要做什么项目：本地部署的 AI 私有知识库
- 项目最终效果展示（截图 + 功能清单）

```
你将构建的系统：

  上传文档 → AI 解析入库 → 基于文档内容精准问答

  技术栈全景：
  ┌─────────────────────────────────────────────┐
  │  前端: Next.js + TailwindCSS                  │
  │  后端: NestJS + TypeORM + SQLite              │
  │  AI:  LLM (DeepSeek) + Embedding + ChromaDB   │
  │  部署: 全部本地运行，数据不上云                   │
  └─────────────────────────────────────────────┘
```

---

### 第一部分：后端基础 —— 前端人的 NestJS 快速上手

> 目标：用前端的知识类比，让你在最短时间理解后端核心概念

#### 第 1 章：环境搭建 —— 5 分钟启动你的第一个后端项目

- NestJS 是什么？和 Express 的关系（类比 Next.js 和 React）
- pnpm monorepo 搭建（前后端放一个仓库）
- NestJS CLI 创建项目
- 目录结构解读：Module / Controller / Service 三件套
- 用前端类比理解后端架构

```
前端思维                     后端对应
React Component      →    Controller（处理请求）
Custom Hook          →    Service（业务逻辑）
Context Provider     →    Module（依赖注入容器）
Props / State        →    DTO（数据传输对象）
React Router         →    装饰器路由 @Get() @Post()
```

- 实战：启动项目，浏览器看到 Hello World

#### 第 2 章：Swagger —— 后端的 Storybook

- Swagger 是什么？为什么后端离不开它
- 类比前端的 Storybook：组件有预览，API 也要有
- 安装配置 Swagger
- 核心装饰器：@ApiTags、@ApiOperation、@ApiProperty
- 实战：打开浏览器直接测试 API
- 踩坑记录：常见报错排查

#### 第 3 章：数据库入门 —— 从 localStorage 到 SQLite

- 前端存数据：localStorage / IndexedDB / Cookie
- 后端存数据：为什么需要数据库？
- SQLite 选型：为什么不用 MySQL / PostgreSQL
- TypeORM 是什么：用 TypeScript 类操作数据库（类比 Prisma）
- Entity 实体 = 数据库表的 TypeScript 定义
- Repository 仓库 = CRUD 方法集合
- 实战：创建知识库表，实现增删改查 API
- 踩坑记录：`:memory:` vs 文件持久化

#### 第 4 章：四个模块骨架 —— 搭建完整的 API 结构

- 模块化设计思想（类比前端的页面模块划分）
- 知识库模块（knowledge-base）
- 文档模块（document）
- 搜索模块（search）
- 对话模块（chat）
- DTO 校验：class-validator 防止脏数据
- 实战：Swagger 上测试所有 CRUD 接口

---

### 第二部分：文档处理 —— 从文件上传到 AI 可用

> 目标：把用户上传的文件变成 AI 能理解的格式

#### 第 5 章：文件上传 —— 后端怎么接收前端传来的文件

- 前端上传文件的原理：FormData + multipart/form-data
- 后端接收文件：Multer 中间件
- 文件类型校验、大小限制、存储路径配置
- `@UseInterceptors(FileInterceptor)` 装饰器
- 状态管理：uploaded → parsing → embedding → done / failed
- 实战：通过 Swagger 上传文件，查看本地存储目录
- 踩坑记录：中文文件名乱码、文件大小限制

#### 第 6 章：文件解析 —— PDF 不是你看到的那样

- 为什么不能直接 readFile 读 PDF？（二进制格式 vs 纯文本）
- 四种格式的解析策略
  - PDF → pdf-parse（提取文本层）
  - Word → mammoth（解压 XML）
  - Markdown / TXT → fs 直接读取
- 工具函数设计：一个 parseFile 搞定所有格式
- 实战：上传文件 → 后端日志打印出提取的文本
- 踩坑记录：扫描件 PDF 没有文本层

#### 第 7 章：文本切片 —— 给 AI 喂饭要切碎

- 为什么要切片？（类比前端虚拟滚动）
- LangChain RecursiveCharacterTextSplitter
- 切片参数调优：chunkSize 和 overlap
- 分隔符优先级：段落 > 换行 > 空格 > 强切
- 实战：一篇文档切成 N 个片段，查看切片效果

---

### 第三部分：向量与搜索 —— AI 的核心能力

> 目标：理解向量、Embedding、语义搜索的原理，并实现它们

#### 第 8 章：向量化 —— 让文字变成 AI 能理解的数字

- 什么是向量？（一组数字代表语义位置）
- 什么是 Embedding 模型？（文本 → 向量的转换器）
- MODEL_NAME vs EMBEDDING_MODEL：两个模型各司其职
- 云端模型 vs 本地模型（硅基流动 / Ollama）
- Ollama 本地部署：完全免费、数据不出本机
- 实战：把一段文字转成向量，看看输出长什么样

#### 第 9 章：ChromaDB —— 专门存向量的数据库

- 为什么不能用 SQLite 存向量？
- ChromaDB 核心概念：Collection、Document、Embedding、Metadata
- 安装和启动 ChromaDB
- 存入向量：storeChunks 函数
- 分批处理：避免 413 Payload Too Large
- 实战：上传文件 → 切片 → 向量化 → 存入 ChromaDB，全链路跑通
- 踩坑记录：API 413、Collection 命名规则（不支持中文）

#### 第 10 章：语义搜索 —— 用"意思"而不是"关键词"找内容

- 语义搜索 vs 关键词搜索：为什么 "数据库配置" 能搜到 "TypeORM 连接设置"
- 搜索原理：查询文本 → 向量化 → ChromaDB 相似度匹配 → Top-K 结果
- distance 和 score 详解：L2 距离、余弦距离、分数转换
- 搜索结果的质量评估：什么分数算"相关"
- 搜索历史记录
- 实战：上传一个文档，用不同的问题搜索，观察结果质量
- 踩坑记录：score 为负值、搜索结果 content 是页码

---

### 第四部分：RAG 对话 —— 让 AI 基于你的文档回答问题

> 目标：实现完整的 RAG 链路，这是整个系统最激动人心的部分

#### 第 11 章：RAG 是什么 —— AI 的"开卷考试"

- LLM 的三个致命问题：知识过时、不知道私有信息、幻觉
- RAG 的核心思路：先搜资料，再让 AI 基于资料回答
- RAG 三步曲：检索（Retrieval）→ 增强（Augmented）→ 生成（Generation）
- RAG vs 微调（Fine-tuning）：什么时候用哪个
- 使用场景：企业知识库、客服机器人、法律咨询、代码助手
- OpenAI 兼容接口：一套代码对接多个模型（DeepSeek / 通义千问 / Ollama）

#### 第 12 章：Prompt 工程 —— 怎么让 AI 好好回答问题

- System Prompt 的作用：给 AI 下达"行为规则"
- 构造 RAG Prompt：系统指令 + 参考资料 + 用户问题
- 引用溯源：让 AI 标注 [1] [2] 引用编号
- 多轮对话：history 消息的作用和长度控制
- Prompt 调优技巧：怎么让回答更精准、更简洁、不瞎编
- 实战：对比不同 Prompt 的回答质量

#### 第 13 章：流式输出 —— ChatGPT 打字机效果的秘密

- 为什么需要流式输出？（10 秒空白 vs 第 1 秒就有内容）
- SSE（Server-Sent Events）协议：HTTP 连接不关闭，持续推送
- 数据流经的四层：LLM API → openai SDK → Service → Controller
- AsyncGenerator：async function* 和 yield 的原理
- NestJS 中实现 SSE：手动设置响应头 + res.write
- 为什么用 POST + fetch 而不是 GET + EventSource
- 实战：curl --no-buffer 看到逐字输出
- 踩坑记录：Swagger 超时断开（Failed to fetch）

#### 第 14 章：对话管理 —— 会话、消息、历史

- 数据模型设计：chat_session + chat_message 两张表
- 会话自动创建：无 sessionId 时新建
- 消息持久化：用户消息和 AI 回答都存数据库
- 引用溯源：AI 消息的 references 字段
- 对话历史接口：获取会话列表 + 消息详情
- 级联删除：先删消息再删会话（避免孤儿数据）
- 实战：多轮对话 → 查看历史 → 删除会话

---

### 第五部分：前端页面 —— 从 API 到产品

> 目标：用你最熟悉的 React 技能，把后端 API 变成可用的产品

#### 第 15 章：Next.js 项目搭建

- Next.js App Router：文件系统路由（创建文件 = 创建页面）
- TailwindCSS 快速上手：class 即样式
- pnpm workspace：前后端在一个仓库里协作
- 项目结构规划：pages / components / lib / types
- API 调用封装：一个 api.ts 管理所有后端接口
- 跨域问题：CORS 是什么，后端怎么解决

#### 第 16 章：知识库管理页

- 列表页：展示所有知识库
- 创建表单：输入名称和描述
- 详情页：展示文档列表
- 文件上传组件：FormData + 进度提示
- 删除确认：防止误操作
- 状态刷新：操作后自动更新列表

#### 第 17 章：对话页面 —— 核心交互

- 布局设计：左侧栏（知识库 + 对话列表）+ 右侧对话窗口
- 消息气泡组件：用户消息靠右蓝色，AI 消息靠左白色
- SSE 流式消费：fetch + ReadableStream 逐字渲染
- "打字机效果"实现：空消息占位 → 逐字追加 content
- 自动滚动到底部：useRef + scrollIntoView
- 多轮对话：sessionId 复用
- 加载状态：发送中禁用输入框
- 引用来源展示：references 渲染为可折叠的引用卡片

#### 第 18 章：体验优化

- Markdown 渲染：AI 回答常带 Markdown 格式
- 代码高亮：引用的代码片段语法高亮
- 空状态设计：没有对话时的引导页
- 暗色模式（可选）
- 响应式布局：移动端适配
- 错误处理：网络异常、API 报错的友好提示

---

### 第六部分：工程化与部署

> 目标：让项目从"能跑"变成"能用"

#### 第 19 章：开发工具链

- Git 规范：husky + commitlint（提交信息规范化）
- ESLint + Prettier：代码风格统一
- Winston 日志系统：后端日志分级和持久化
- 环境变量管理：.env + ConfigModule
- 常用命令行工具：jq、curl 测试技巧

#### 第 20 章：部署与运维（可选进阶）

- Docker 容器化：后端 + ChromaDB + 前端
- docker-compose 一键启动
- Nginx 反向代理
- 从 SQLite 迁移到 PostgreSQL（什么时候该换）
- 模型切换：从 Ollama 本地到云端 API

---

### 结尾

#### 第 21 章：总结与展望

- 你学到了什么（技术栈复盘）
- 这个项目还能怎么扩展
  - 支持更多文件格式（Excel、PPT、图片 OCR）
  - 多用户权限控制
  - 对话导出（Markdown / PDF）
  - 接入更多模型（Claude / GPT-4 / 本地大模型）
  - 知识图谱可视化
- 前端转全栈的成长路线建议
- 如何用这个项目在面试中讲出亮点

---

## 小册子亮点设计

### 1. 每章标配的四个板块

| 板块 | 说明 |
|------|------|
| **前端类比** | 用前端概念解释后端知识，降低理解成本 |
| **流程图** | ASCII 流程图可视化数据流向，不用猜 |
| **踩坑记录** | 真实开发中遇到的坑 + 解决方案，不是理论推导 |
| **知识图谱** | 每章结尾的树状图，串联本章知识点 |

### 2. 渐进式难度

```
第一部分：后端基础
  难度：⭐⭐
  前端人最容易上手的部分，大量类比

第二部分：文档处理
  难度：⭐⭐
  文件操作，逻辑清晰

第三部分：向量与搜索
  难度：⭐⭐⭐
  新概念多（向量、Embedding、ChromaDB），但原理讲透就不难

第四部分：RAG 对话
  难度：⭐⭐⭐⭐
  整个系统的高潮，串联前面所有知识

第五部分：前端页面
  难度：⭐⭐
  回到舒适区，用 React 技能收尾

第六部分：工程化
  难度：⭐⭐
  锦上添花
```

### 3. 区别于同类小册的卖点

| 同类小册的问题 | 本册的做法 |
|---------------|-----------|
| 教 NestJS 但没有实际项目 | 每一章都在推进一个完整项目 |
| 教 AI 但不教工程化 | 从环境搭建到部署全覆盖 |
| 面向后端开发者写的 | 专门为前端人设计，大量前端类比 |
| 只有代码没有原理 | 先讲为什么，再讲怎么做 |
| 用 Python 写 AI 项目 | 全程 TypeScript，前端人零切换成本 |
| 理论太多不落地 | 每章有踩坑记录，全是真实问题 |

---

## 章节与源码的对应关系

| 章节 | 对应文档 | 核心文件 |
|------|---------|---------|
| 第 5 章 | step1-file-upload.md | multer.config.ts, document.controller.ts |
| 第 6 章 | step2-file-parsing.md | file-parser.util.ts |
| 第 7 章 | step3-text-chunking.md | text-splitter.util.ts |
| 第 8-9 章 | step4-vectorize-and-store.md | vector-store.util.ts |
| 第 10 章 | step5-semantic-search.md | search.service.ts |
| 第 11-13 章 | step6-rag-conversation.md | llm.util.ts, chat.service.ts |
| 第 14 章 | step7-chat-history.md | chat.controller.ts |
| 第 15-18 章 | step8-frontend.md | frontend/src/ |
| 附录 | swagger-guide.md, blog-nestjs-startup-debugging.md | - |
