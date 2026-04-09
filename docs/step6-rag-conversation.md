# 第六步：RAG 对话（检索增强生成）

## 基础概念：什么是 RAG？

### 一句话解释

**RAG（Retrieval-Augmented Generation，检索增强生成）** = 先搜资料，再让 AI 根据资料回答。

### 为什么需要 RAG？

直接问 AI（如 ChatGPT / DeepSeek）有三个致命问题：

```
问题 1：知识过时
  你：2024 年公司新出的报销制度是什么？
  AI：我的训练数据截止到 2023 年，我不知道。

问题 2：不知道私有信息
  你：我们项目的数据库密码配置在哪个文件？
  AI：通常在 .env 文件中... （泛泛而谈，不知道你项目的具体情况）

问题 3：幻觉（Hallucination）
  你：公司年假政策是什么？
  AI：一般来说年假是 5 天...（一本正经地瞎编，和你公司实际政策完全不同）
```

**RAG 的核心思路**：别让 AI 凭记忆回答，先帮它找到相关资料，再让它基于资料回答。

```
没有 RAG：
  用户提问 ──────────────────────→ AI 凭记忆回答（可能过时/瞎编）

有 RAG：
  用户提问 ──→ 先从知识库搜索相关资料 ──→ 把资料 + 问题一起给 AI ──→ AI 基于资料回答（准确可靠）
```

### 类比理解

```
开卷考试 vs 闭卷考试：

闭卷（无 RAG）：
  老师问："第三章的核心公式是什么？"
  学生全凭记忆回答 → 可能记错、记混、瞎编

开卷（有 RAG）：
  老师问："第三章的核心公式是什么？"
  学生先翻书找到相关页 → 然后基于书上内容回答 → 准确可靠
  
RAG 就是让 AI 做"开卷考试"，知识库就是那本"书"。
```

### RAG 的三个核心阶段

| 阶段 | 英文 | 做什么 | 类比 |
|------|------|--------|------|
| **检索** | Retrieval | 从知识库搜索与问题最相关的文档片段 | 翻书找到相关页 |
| **增强** | Augmented | 把搜到的片段作为上下文拼进 Prompt | 把相关页摊开放桌上 |
| **生成** | Generation | LLM 根据上下文 + 问题生成回答 | 看着书回答问题 |

### 使用场景

| 场景 | 举例 | 为什么需要 RAG |
|------|------|---------------|
| **企业知识库问答** | 内部文档、制度手册、技术文档 | AI 不知道企业私有信息 |
| **客服机器人** | 产品说明书、FAQ、售后政策 | 需要精准回答，不能瞎编 |
| **法律/医疗咨询** | 法规条文、用药说明 | 必须基于权威资料，幻觉可能致命 |
| **代码助手** | 项目源码、API 文档 | AI 不知道你项目的具体代码 |
| **学术研究** | 论文库、实验数据 | 需要引用原文出处 |
| **个人笔记助手** | 读书笔记、学习资料 | 从自己的知识积累中检索 |

### RAG vs 微调（Fine-tuning）

你可能听过另一种让 AI 学习新知识的方法——微调。它们的区别：

```
微调（Fine-tuning）：
  把新知识"烧进" AI 的大脑 → 训练成本高、更新慢、需要 GPU
  类比：让学生把整本书背下来

RAG（检索增强生成）：
  知识存在外部数据库，用的时候现查 → 成本低、随时更新、不需要训练
  类比：让学生带着书开卷考试

什么时候用微调？
  → 需要 AI 学习新的"能力"（比如学会写特定风格的文案）

什么时候用 RAG？
  → 需要 AI 使用新的"知识"（比如回答基于最新文档的问题）
  → 大多数企业场景用 RAG 就够了 ✅
```

### 我们的项目在做什么？

```
我们正在构建的系统：

  用户上传文档（PDF/Word/TXT/MD）
       │
       ▼
  文档解析 → 文本切片 → 向量化 → 存入 ChromaDB
       │                               │
       │                               │ ← 知识库（RAG 的"书"）
       │                               │
       ▼                               ▼
  用户提问 ──→ 语义搜索（检索）──→ 构造 Prompt（增强）──→ LLM 生成回答（生成）
                                                           │
                                                           ▼
                                                    流式输出给用户

前五步完成了上半部分（上传→存储→搜索）
这一步完成下半部分（搜索→构造Prompt→生成回答）= RAG 的核心
```

---

## 基础概念：MODEL_NAME 和 EMBEDDING_MODEL

### 这两个模型分别干什么？

在 `.env` 中有两个模型配置，它们是**完全不同的两种 AI 模型**，各司其职：

```
.env 中的两个模型配置：

  MODEL_NAME=deepseek-r1:7b           ← 对话模型（LLM）
  EMBEDDING_MODEL=nomic-embed-text     ← 嵌入模型（Embedding）
```

```
用户提问: "NestJS 怎么连接数据库？"
              │
              ├──→ EMBEDDING_MODEL（嵌入模型）
              │     把问题转成向量 [0.015, -0.023, ...]
              │     → 去 ChromaDB 搜索相似片段
              │     → 找到 3 个相关文档片段
              │
              └──→ MODEL_NAME（对话模型）
                    拿到 3 个片段 + 用户问题
                    → 生成自然语言回答
                    → "在 NestJS 中，你可以通过 TypeORM 来连接数据库..."
```

### EMBEDDING_MODEL（嵌入模型）— 负责"搜索"

**作用**：把文本转成向量（一组数字），让计算机能计算文本之间的"语义距离"。

```
嵌入模型的工作：

  输入: "数据库配置"
  输出: [0.015, -0.023, 0.041, 0.008, ..., -0.019]   ← 一个 768 维的向量
        （768 个浮点数，代表这段文字在语义空间中的"坐标"）

  输入: "DB setup"
  输出: [0.013, -0.021, 0.039, 0.010, ..., -0.017]   ← 另一个向量
        （和上面的向量很接近，因为语义相似）
```

**嵌入模型的特点**：
- 只做**文本→向量**的转换，不会生成文字
- 输入一段文本，输出一组固定长度的数字
- 速度快、体积小（几百 MB）
- 不同模型输出的向量维度不同（768 维、1024 维、1536 维等）

**在项目中被调用的两个地方**：
1. **上传文档时**：把每个文本切片转成向量，存入 ChromaDB
2. **搜索/对话时**：把用户的问题转成向量，去 ChromaDB 找最相似的片段

```
上传时（vector-store.util.ts → storeChunks）：
  文档片段 "TypeORM 是 NestJS 中最常用的 ORM..." ──→ EMBEDDING_MODEL ──→ [0.02, -0.01, ...] ──→ 存入 ChromaDB

搜索时（vector-store.util.ts → searchSimilar）：
  用户问题 "怎么连接数据库？" ──→ EMBEDDING_MODEL ──→ [0.015, -0.023, ...] ──→ 在 ChromaDB 中找相似向量
```

**重要**：上传和搜索必须用**同一个**嵌入模型。因为不同模型对同一段文字产生的向量不同，换模型后旧向量就"对不上"了，搜索结果会乱。

### MODEL_NAME（对话模型 / LLM）— 负责"回答"

**作用**：根据上下文和问题，生成自然语言的回答。就是我们平时用的 ChatGPT、DeepSeek 那种 AI 对话。

```
对话模型的工作：

  输入:
    System: 你是知识库助手。参考资料：[1] TypeORM 是... [2] 在 app.module.ts 中配置...
    User: NestJS 怎么连接数据库？

  输出:
    "在 NestJS 中连接数据库，主要通过 TypeORM 来实现。
     首先需要在 app.module.ts 中配置 TypeOrmModule.forRoot()..."
```

**对话模型的特点**：
- 能**理解问题**并**生成文字**回答
- 体积大（7B 参数 = 4~5 GB）
- 速度较慢（逐 token 生成，所以需要流式输出）
- 支持多轮对话（记住上下文）

**在项目中只在一个地方调用**：
- `llm.util.ts → streamChat()`：RAG 对话的最后一步，拿着检索到的片段 + 用户问题，生成回答

### 两者对比

| | EMBEDDING_MODEL（嵌入模型） | MODEL_NAME（对话模型） |
|------|--------------------------|---------------------|
| 作用 | 文本 → 向量（数字） | 上下文 + 问题 → 自然语言回答 |
| 能力 | 只能转换，不能"说话" | 能理解、能"说话" |
| 体积 | 小（几百 MB） | 大（几 GB） |
| 速度 | 快 | 慢（需要流式） |
| 调用时机 | 上传文档时 + 搜索/对话时 | 对话时 |
| 输出 | `[0.015, -0.023, 0.041, ...]` | `"在 NestJS 中..."` |
| 换模型影响 | 需要重新上传所有文档（重建向量） | 无影响，随时可换 |

### 类比理解

```
图书馆的比喻：

  EMBEDDING_MODEL = 图书管理员
    负责给每本书贴标签、编目录
    你问一个问题，他帮你找到最相关的几本书
    他自己不回答问题，只负责找书

  MODEL_NAME = 学科专家
    你把找到的书和问题一起交给他
    他阅读相关章节，然后用自己的话给你解答
    他不负责找书，只负责回答
```

---

## Ollama 本地部署指南

### 什么是 Ollama？

Ollama 让你在自己电脑上运行 AI 模型，不需要联网、不需要 API Key、不花钱。模型跑在本地，数据完全私有。

### 安装

```bash
# macOS
brew install ollama

# 或者去官网下载桌面应用
# https://ollama.com
```

### 常用命令

```bash
# 启动服务（如果用桌面应用则自动启动，不需要手动运行）
ollama serve

# 查看已下载的模型
ollama list

# 下载模型
ollama pull 模型名

# 删除模型（释放磁盘空间）
ollama rm 模型名

# 直接在终端和模型对话（测试用）
ollama run 模型名
```

### 本项目需要的模型

```bash
# 1. 对话模型（用于 RAG 回答生成）
ollama pull deepseek-r1:7b      # 4.7 GB，推理能力强

# 2. 嵌入模型（用于文本向量化）
ollama pull nomic-embed-text     # 274 MB，专门做 Embedding
```

### .env 配置

```bash
# AI 模型配置（Ollama 本地）
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
MODEL_NAME=deepseek-r1:7b
EMBEDDING_MODEL=nomic-embed-text
```

**为什么 Ollama 的地址格式和 OpenAI 一样？**

Ollama 内置了 OpenAI 兼容接口（`/v1/chat/completions`、`/v1/embeddings`），所以我们的代码不需要任何修改，只改环境变量就能从云端 API 切换到本地模型。

### 验证 Ollama 是否正常

```bash
# 测试对话模型
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-r1:7b","messages":[{"role":"user","content":"你好"}],"max_tokens":10}'

# 测试嵌入模型
curl http://localhost:11434/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","input":"测试文本"}'
```

### 注意事项

1. **首次运行会慢**：模型第一次加载到内存需要几秒到十几秒，后续请求会快很多
2. **内存占用**：7B 模型大约需要 5~6 GB 内存，确保电脑有足够空闲内存
3. **换了 Embedding 模型后必须重新上传文档**：之前用硅基流动的 `bge-large-zh-v1.5`（1024 维）存的向量，和 Ollama 的 `nomic-embed-text`（768 维）维度不同，旧向量无法使用
4. **Ollama 服务必须在运行**：后端启动前确保 Ollama 服务已启动（桌面应用会自动启动，命令行需要 `ollama serve`）

### 重建向量数据（换 Embedding 模型后必做）

换了 Embedding 模型后，旧向量的维度和新模型不匹配，必须清掉重建。

#### 为什么必须重建？

```
旧模型（bge-large-zh-v1.5）输出 1024 维向量：
  "数据库配置" → [0.01, -0.02, 0.03, ..., 0.005]   ← 1024 个数字

新模型（nomic-embed-text）输出 768 维向量：
  "数据库配置" → [0.03, 0.01, -0.04, ..., 0.008]   ← 768 个数字

搜索时用新模型生成 768 维的查询向量，去和旧的 1024 维向量比较 → 维度不匹配，直接报错
```

#### 方法一：通过 API 删除指定 collection（推荐）

```bash
# 1. 查看当前有哪些 collection
curl -s http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections | python3 -m json.tool

# 返回结果中的 "name" 字段就是 collection 名，格式为 kb_xxx（xxx 是知识库 ID）

# 2. 删除指定 collection（把 kb_string 换成你实际的 collection 名）
curl -X DELETE http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections/kb_string

# 3. 确认删除成功（再查一次，应该为空数组 []）
curl -s http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections
```

#### 方法二：停掉 ChromaDB，删除数据目录，重新启动

```bash
# 1. 停掉 ChromaDB（Ctrl+C 或 kill 进程）

# 2. 找到 ChromaDB 数据目录并删除
#    默认路径取决于你启动 chroma run 时所在的目录，通常是 ./chroma_data 或 ~/.chroma
#    如果不确定，可以搜索：
find ~ -name "chroma.sqlite3" -maxdepth 5 2>/dev/null

# 3. 删除找到的目录
rm -rf 找到的目录路径

# 4. 重新启动
chroma run
```

#### 删除后重新上传文档

```bash
# 通过 Swagger（http://localhost:3000/api）或 curl 重新上传文件
curl -X POST http://localhost:3000/documents/upload \
  -F "file=@你的文件路径.pdf" \
  -F "knowledgeBaseId=你的知识库ID"
```

上传后新的 Embedding 模型会生成新维度的向量，搜索和对话就能正常工作了。

### 云端 vs 本地模型对比

| | 云端（硅基流动） | 本地（Ollama） |
|------|---------------|---------------|
| 费用 | 按量付费 | 完全免费 |
| 速度 | 快（服务器 GPU） | 较慢（本地 CPU/GPU） |
| 质量 | 高（大模型） | 中等（受模型大小限制） |
| 隐私 | 数据发到云端 | 数据完全本地 |
| 网络 | 需要联网 | 不需要 |
| 配置 | 只需 API Key | 需要下载模型（几 GB） |

---

## 目标

实现 `POST /chat/message` 接口，用户发送问题，系统自动从知识库检索相关片段，结合上下文调用 LLM 生成回答，并通过 SSE 流式输出。

## 这一步在干什么？

```
用户提问: "NestJS 怎么连接数据库？"
         │
         ▼ 第一步：检索（Retrieval）
         │  调用第五步写好的 searchSimilar
         │
         ▼
  找到相关片段:
  ┌─────────────────────────────────────────────────┐
  │ "TypeORM 是 NestJS 中最常用的 ORM 框架..."          │
  │ "在 app.module.ts 中配置 TypeOrmModule..."         │
  │ "数据库连接需要在 .env 中设置..."                     │
  └─────────────────────────────────────────────────┘
         │
         ▼ 第二步：增强（Augmented）
         │  把片段塞进 Prompt 作为上下文
         │
         ▼
  构造的 Prompt:
  ┌─────────────────────────────────────────────────┐
  │ System: 你是知识库助手，根据以下参考资料回答问题。      │
  │                                                   │
  │ 参考资料:                                          │
  │ [1] TypeORM 是 NestJS 中最常用的 ORM 框架...        │
  │ [2] 在 app.module.ts 中配置 TypeOrmModule...       │
  │ [3] 数据库连接需要在 .env 中设置...                   │
  │                                                   │
  │ User: NestJS 怎么连接数据库？                        │
  └─────────────────────────────────────────────────┘
         │
         ▼ 第三步：生成（Generation）
         │  调用 LLM（DeepSeek / OpenAI）
         │
         ▼
  AI 回答（逐字流式输出）:
  "在 NestJS 中连接数据库，主要通过 TypeORM 来实现。
   首先在 app.module.ts 中配置 TypeOrmModule.forRoot()，
   然后在 .env 中设置数据库连接参数..."
```

### RAG 三步曲

| 步骤 | 英文 | 做什么 | 对应代码 |
|------|------|--------|---------|
| 检索 | Retrieval | 从向量库搜索相关片段 | `searchSimilar()`（已有） |
| 增强 | Augmented | 把片段拼进 Prompt | 新写的 Prompt 模板 |
| 生成 | Generation | 调用 LLM 生成回答 | 新写的 LLM 调用逻辑 |

### 什么是 SSE（Server-Sent Events）？

```
普通 HTTP 请求（一次性返回）:
  客户端 ──请求──> 服务端
  客户端 <──────── 服务端（等 AI 生成完所有内容后，一次性返回）
  ⏱ 用户等 10 秒看到完整回答

SSE 流式输出:
  客户端 ──请求──> 服务端
  客户端 <── "在"    服务端
  客户端 <── "NestJS" 服务端
  客户端 <── "中"    服务端
  客户端 <── "连接"  服务端
  客户端 <── "数据库" 服务端
  客户端 <── "..."   服务端
  ⏱ 用户第 1 秒就开始看到内容，体验好得多
```

SSE 的本质：HTTP 连接不关闭，服务端持续往客户端推数据。和 WebSocket 的区别是 SSE 是单向的（服务端→客户端），更简单。

---

## 深入理解：流式输出的完整链路

### 为什么需要流式输出？

LLM 生成文本的速度大约是 **30~80 个 token/秒**。一个 500 字的回答大约需要 6~15 秒。

```
非流式（等全部生成完再返回）：
  0s ────── 等待中，页面空白 ────── 10s → 突然出现完整回答
  用户体验：😤 "这破系统是不是卡死了？"

流式（边生成边返回）：
  0s → "根" → "据" → "参考" → "资料" → "，" → ... → 10s → 完成
  用户体验：😊 "哦，它在回答了，有在思考的感觉"
```

ChatGPT、DeepSeek、Kimi 等产品全部用的流式输出，这是 AI 对话产品的标配体验。

### 数据流经的四层

```
┌─────────────────────────────────────────────────────────────┐
│                    完整数据流路径                               │
│                                                               │
│  ① LLM API（硅基流动）                                        │
│     AI 模型逐个 token 生成，通过 HTTP 流式响应返回                │
│     ↓                                                        │
│  ② openai SDK（streamChat 函数）                              │
│     把 API 的流式响应解析成一个个文本片段                         │
│     ↓                                                        │
│  ③ ChatService（sendMessage 方法）                            │
│     拿到每个片段，yield 给 Controller，同时拼接完整回答            │
│     ↓                                                        │
│  ④ ChatController（SSE 接口）                                 │
│     把每个片段包装成 SSE 格式，write 到 HTTP 响应流               │
│     ↓                                                        │
│  ⑤ 浏览器 / curl                                              │
│     收到 SSE 事件，逐字渲染到界面上                              │
└─────────────────────────────────────────────────────────────┘
```

### 每一层在干什么？逐层拆解

#### 第 ① 层：LLM API 的流式响应

当你给 OpenAI 兼容 API 发送 `stream: true` 的请求时，API 不会等生成完再返回，而是**每生成一个 token 就立刻推送一个数据块**。

```
普通请求（stream: false）：
  请求 → API 内部生成 500 个 token → 一次性返回完整 JSON

流式请求（stream: true）：
  请求 → API 生成第 1 个 token → 立即返回 → 生成第 2 个 → 立即返回 → ...

API 返回的原始格式（SSE）：
  data: {"choices":[{"delta":{"content":"根"}}]}
  data: {"choices":[{"delta":{"content":"据"}}]}
  data: {"choices":[{"delta":{"content":"参考"}}]}
  data: {"choices":[{"delta":{"content":"资料"}}]}
  data: [DONE]
```

注意：普通响应用 `message.content`，流式响应用 `delta.content`。`delta` 的意思是"增量"——每次只给你新增的那一小块。

#### 第 ② 层：openai SDK 解析流（llm.util.ts）

```ts
export async function* streamChat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): AsyncGenerator<string> {
  // 发起流式请求
  const stream = await client.chat.completions.create({
    model: modelName,
    messages,
    stream: true,  // ← 关键：开启流式
  });

  // 逐个读取 API 推送的数据块
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;  // 每收到一个片段就往外吐一个
    }
  }
}
```

**逐行解释：**

```ts
stream: true
```
- 告诉 API："别等生成完，边生成边给我"
- API 返回的不是一个 JSON，而是一个**流**（Stream）

```ts
for await (const chunk of stream) {
```
- `for await` 是 **异步迭代**，用于消费异步数据流
- 普通 `for` 循环遍历数组（数据已经全在内存中）
- `for await` 遍历流（数据是一点一点到达的）
- 类比：普通 for 循环像翻一本已经印好的书，`for await` 像看直播字幕——它一句一句蹦出来，你一句一句读

```ts
chunk.choices[0]?.delta?.content
```
- `delta` 是增量数据，每次只有新生成的那几个字
- `?.` 可选链——如果某个字段不存在不会报错，返回 undefined

```ts
yield content;
```
- `yield` 是 Generator 的核心关键字
- 意思是：**暂停执行，把这个值交出去，等调用方要下一个时再继续**
- 和 `return` 的区别：`return` 是函数结束，`yield` 是暂停，后面还会继续

#### 第 ③ 层：Service 中转（chat.service.ts）

```ts
async *sendMessage(content: string, knowledgeBaseId?: string, sessionId?: string) {
  // ... 前面是检索、构造 Prompt 等逻辑 ...

  let fullResponse = '';

  for await (const chunk of streamChat(messages)) {
    fullResponse += chunk;          // 拼接完整回答（最后要存数据库）
    yield {                         // 每个片段包装后传给 Controller
      type: 'chunk',
      data: chunk,
      sessionId: session.id,
    };
  }

  // 流结束后，保存完整回答到数据库
  await this.messageRepository.save({
    sessionId: session.id,
    role: 'assistant',
    content: fullResponse,           // ← 完整的回答文本
    references,
  });

  yield { type: 'done', data: '', sessionId: session.id };
}
```

**Service 层做了两件事：**

```
streamChat 产出:  "根"   "据"   "参考"   "资料"   "，"   ...
                   ↓      ↓      ↓        ↓       ↓
Service 做的事:
  1. 拼接:     fullResponse = "根" + "据" + "参考" + "资料" + "，" + ...
                              （积攒完整回答，最后存数据库）
  2. 转发:     yield → Controller → 用户
                              （每个片段实时传出去）
```

这里 `async *sendMessage` 本身也是一个 AsyncGenerator，所以它既能用 `for await` 消费上游的流，又能用 `yield` 向下游产出数据。**就像一根水管中间加了个过滤器**。

#### 第 ④ 层：Controller 输出 SSE（chat.controller.ts）

```ts
@Post('message')
async sendMessage(@Body() dto: SendChatMessageDto, @Res() res: Response) {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();  // 立即把响应头发给客户端

  try {
    for await (const event of this.chatService.sendMessage(...)) {
      // 每收到一个事件，立刻写入 HTTP 响应流
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
  } finally {
    res.end();  // 流结束，关闭连接
  }
}
```

**逐行解释：**

```ts
res.setHeader('Content-Type', 'text/event-stream');
```
- 告诉浏览器："我返回的不是普通 JSON，是 SSE 事件流"
- 浏览器看到这个 Content-Type 就知道要用 EventSource 方式处理

```ts
res.flushHeaders();
```
- **立即**把响应头发给客户端
- 普通响应是等 body 准备好再一起发
- SSE 需要先发头，让客户端知道"连接建立了，准备接收数据"

```ts
res.write(`data: ${JSON.stringify(event)}\n\n`);
```
- `res.write()` 往 HTTP 响应里写一块数据，**但不关闭连接**
- 和 `res.send()` / `res.json()` 的区别：后者写完就关闭连接了
- `data: ` 前缀和 `\n\n` 结尾是 **SSE 协议规定的格式**

```ts
res.end();
```
- 所有数据发完后，手动关闭连接

#### SSE 协议格式详解

```
SSE 是一个非常简单的文本协议，每条消息的格式：

  data: 消息内容\n\n

多条消息就是：

  data: {"type":"chunk","data":"根"}\n\n
  data: {"type":"chunk","data":"据"}\n\n
  data: {"type":"chunk","data":"参考资料"}\n\n
  data: {"type":"done","data":""}\n\n

规则：
  - 每条消息以 "data: " 开头（注意 data 后有个空格）
  - 每条消息以两个换行 "\n\n" 结尾（这是消息之间的分隔符）
  - 一个 "\n" 是字段内换行，两个 "\n\n" 才表示一条消息结束
  - 消息内容通常是 JSON 字符串
```

### AsyncGenerator 链路总结

```
整个流式链路就是三个 AsyncGenerator 串联：

  streamChat()    ──yield──→   sendMessage()   ──yield──→   Controller
  (llm.util.ts)               (chat.service.ts)            (chat.controller.ts)
       │                            │                            │
  从 API 读取流              拼接完整回答 +                 包装成 SSE 格式
  解析出文本片段              添加 sessionId                写入 HTTP 响应流
       │                            │                            │
  yield "根"              yield {chunk,"根"}            write "data: {...}\n\n"
  yield "据"              yield {chunk,"据"}            write "data: {...}\n\n"
  yield "参考"            yield {chunk,"参考"}           write "data: {...}\n\n"
    ...                      ...                           ...
  (结束)                  yield {done}                  res.end()
                          + 存数据库
```

### Generator 和普通函数的区别

```ts
// 普通函数：算完所有结果，一次性返回
function getNumbers(): number[] {
  return [1, 2, 3, 4, 5];  // 5 个数全在内存中
}

// Generator：每次只算一个，调用方要一个给一个
function* getNumbers(): Generator<number> {
  yield 1;  // 暂停，交出 1
  yield 2;  // 暂停，交出 2
  yield 3;  // 暂停，交出 3
}

// Async Generator：每次异步地产出一个值
async function* getChunks(): AsyncGenerator<string> {
  // 等网络数据到达后 yield
  for await (const chunk of networkStream) {
    yield chunk;  // 数据到一块，交一块
  }
}
```

为什么用 Generator 而不是数组？因为 LLM 的回答是**实时生成**的，你不可能等它全部生成完再返回——那就不是流式了。Generator 天然适合这种"数据一点一点到达"的场景。

### SSE vs WebSocket vs 轮询

| 方案 | 方向 | 复杂度 | 适用场景 |
|------|------|--------|---------|
| **SSE** | 服务端→客户端（单向） | 低 | AI 对话、通知推送、日志流 |
| **WebSocket** | 双向 | 中 | 聊天室、游戏、协同编辑 |
| **轮询** | 客户端主动问 | 低 | 简单状态查询 |

AI 对话只需要服务端→客户端的单向推送，用 SSE 最合适。WebSocket 能力更强但更重，这里用不上。

### 前端怎么消费 SSE？

前端消费 SSE 有两种方式，取决于请求方法是 GET 还是 POST。

#### 方式 1：EventSource（仅限 GET 请求）

```ts
// EventSource 是浏览器原生 API，专门为 SSE 设计
const es = new EventSource('/api/stream?q=你好&knowledgeBaseId=xxx');

es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'chunk') {
    // 逐字追加到页面
    document.getElementById('answer').textContent += data.data;
  }
};

es.onerror = () => {
  es.close(); // 出错时关闭连接
};
```

EventSource 的优点是简单、自带断线重连。但有一个致命限制：**只支持 GET 请求**。

```
GET /api/stream?q=你好&knowledgeBaseId=xxx
                 ↑
  参数只能放 URL 里，不能带 request body
```

对于简单的查询还行，但我们的对话接口需要通过 POST body 发送：
- `content`（消息内容，可能很长）
- `knowledgeBaseId`
- `sessionId`

这些放 URL query string 不合适（URL 有长度限制，语义上也应该是 POST），所以 **EventSource 用不了**。

#### 方式 2：fetch + ReadableStream（支持 POST）— 我们用这个

```ts
// 发起 POST 请求
const res = await fetch('/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '这个文档讲了什么？',
    knowledgeBaseId: 'kb-001',
  }),
});

// 拿到响应体的可读流
const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  // 每次读取一块数据
  const { done, value } = await reader.read();
  if (done) break;  // 流结束

  // value 是 Uint8Array（二进制），需要解码成字符串
  const text = decoder.decode(value);

  // text 可能包含多条 SSE 消息，按 "\n\n" 分割
  // 例如 text = 'data: {"type":"chunk","data":"根"}\n\ndata: {"type":"chunk","data":"据"}\n\n'
  const events = text.split('\n\n').filter(Boolean);

  for (const event of events) {
    const jsonStr = event.replace('data: ', '');  // 去掉 SSE 前缀
    const data = JSON.parse(jsonStr);

    if (data.type === 'chunk') {
      // 逐字追加到页面上
      document.getElementById('answer').textContent += data.data;
    } else if (data.type === 'done') {
      console.log('回答完成，sessionId:', data.sessionId);
    } else if (data.type === 'error') {
      console.error('出错了:', data.data);
    }
  }
}
```

**逐行解释关键部分：**

```ts
const reader = res.body.getReader();
```
- `res.body` 是一个 `ReadableStream`（可读流）
- `.getReader()` 获取一个读取器，用来逐块读取数据
- 类比：`res.body` 是一根水管，`reader` 是水龙头

```ts
const { done, value } = await reader.read();
```
- 每次调用 `.read()` 读取一块数据
- `done: true` 表示流结束（水管没水了）
- `value` 是 `Uint8Array` 类型（原始二进制数据）

```ts
const decoder = new TextDecoder();
const text = decoder.decode(value);
```
- 网络传输的数据都是二进制的
- `TextDecoder` 把二进制解码成人能看懂的字符串
- 类比：翻译官，把二进制"翻译"成文字

```ts
const events = text.split('\n\n').filter(Boolean);
```
- 一次 `read()` 可能拿到多条 SSE 消息（网络合包）
- 也可能拿到半条消息（网络拆包）
- 按 `\n\n` 分割是因为 SSE 协议用两个换行分隔消息

#### 两种方式对比

| | EventSource | fetch + ReadableStream |
|------|------------|----------------------|
| HTTP 方法 | 仅 GET | GET / POST 都行 |
| 能带 body | 不能 | 能 |
| 断线重连 | 自动 | 需手动实现 |
| 浏览器兼容 | 很好 | 很好（现代浏览器都支持） |
| 代码量 | 少（3 行） | 多（需要手动解析流） |
| **我们的选择** | 不能用（接口是 POST） | **用这个** |

#### 为什么不把接口改成 GET？

```
GET  /chat/message?content=很长的消息内容...&knowledgeBaseId=xxx&sessionId=xxx
                    ↑
                    问题：
                    1. URL 有长度限制（通常 2KB~8KB），消息内容可能超限
                    2. 语义上"发送消息"是写操作，应该用 POST
                    3. 消息内容会出现在浏览器历史、服务器日志中（隐私问题）
```

所以 POST + fetch ReadableStream 是最合适的方案。这也是 ChatGPT、DeepSeek 等产品采用的方式。

---

## 实现步骤

### 核心调用链

```
Controller（接收请求 + SSE 流式响应）
  → Service（会话管理 + 消息存储）
    → searchSimilar（检索相关片段）
      → 构造 Prompt
        → LLM 流式调用
          → SSE 逐字推送给前端
```

涉及的新文件和改动：

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/common/utils/llm.util.ts` | **新建** | LLM 调用工具（流式 + 非流式） |
| `src/modules/chat/chat.controller.ts` | **修改** | 新增 `POST /chat/message` SSE 接口 |
| `src/modules/chat/chat.service.ts` | **修改** | 新增 RAG 对话核心逻辑 |
| `src/modules/chat/chat.module.ts` | **修改** | 注册 ChatMessage 实体 |

---

### 第 1 步：新建 LLM 工具函数 — `llm.util.ts`

在 `src/common/utils/` 下新建 `llm.util.ts`，封装 LLM 调用。

#### 为什么不直接在 Service 里写？

LLM 调用逻辑（初始化模型、构造消息格式、处理流式响应）和业务逻辑无关，抽出来后：
- 搜索模块以后也可能调用 LLM（搜索结果摘要）
- 换模型时只改一个文件

#### 代码

```ts
import * as dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

/**
 * OpenAI 兼容客户端
 * 硅基流动、DeepSeek、通义千问等国内模型都兼容 OpenAI 接口格式
 */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const modelName = process.env.MODEL_NAME || 'deepseek-ai/DeepSeek-V3';

/**
 * 构造 RAG Prompt
 *
 * @param contexts - 检索到的相关片段数组
 * @param question - 用户的问题
 * @param history - 历史对话消息（可选）
 * @returns OpenAI 格式的消息数组
 */
export function buildRAGMessages(
  contexts: string[],
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  // 把检索到的片段编号拼接
  const contextText = contexts
    .map((c, i) => `[${i + 1}] ${c}`)
    .join('\n\n');

  const systemPrompt = `你是一个知识库助手。请根据以下参考资料回答用户的问题。

要求：
1. 只根据参考资料中的内容回答，不要编造信息
2. 如果参考资料中没有相关内容，请明确告知用户
3. 回答时引用资料编号，如 [1]、[2]
4. 使用中文回答，语言简洁清晰

参考资料：
${contextText}`;

  return [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: question },
  ];
}

/**
 * 流式调用 LLM
 * 返回一个 AsyncIterable，每次 yield 一个文本片段
 *
 * @param messages - OpenAI 格式的消息数组
 * @returns AsyncGenerator，逐个 yield 文本片段
 */
export async function* streamChat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model: modelName,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
```

#### 关键概念解释

```ts
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,  // 指向硅基流动
});
```
- 这里用的是 **OpenAI 的 SDK**，但通过 `baseURL` 指向了硅基流动
- 国内的 DeepSeek、通义千问、硅基流动等都兼容 OpenAI 接口格式
- 所以同一套代码，换个 `baseURL` 和 `apiKey` 就能切换模型

```ts
export async function* streamChat(...): AsyncGenerator<string> {
```
- `function*` 是 Generator 函数，`async function*` 是异步 Generator
- `yield content` 每次产出一个文本片段
- 调用方用 `for await (const chunk of streamChat(...))` 逐个消费
- 这就是"流式"的实现原理：不是一次返回所有内容，而是一块一块地给

#### 安装依赖

需要安装 `openai` SDK：

```bash
cd backend
pnpm add openai
```

> 为什么用 `openai` SDK 而不是 LangChain 的 ChatOpenAI？
> - `openai` SDK 的流式 API 更轻量、更直接
> - LangChain 的流式在 NestJS SSE 场景下封装太深，调试困难
> - Embedding 继续用 LangChain（因为 ChromaDB 集成方便），LLM 调用用原生 SDK

---

### 第 2 步：修改 ChatService — 新增 RAG 对话逻辑

在 `chat.service.ts` 中新增 `sendMessage` 方法。

#### 新增的 import

```ts
import { ChatMessage } from './entities/chat.entity';
import { searchSimilar } from '../../common/utils/vector-store.util';
import { buildRAGMessages, streamChat } from '../../common/utils/llm.util';
```

#### 新增方法

```ts
/**
 * 发送消息并获取 AI 回答（RAG 流式）
 *
 * 流程：
 * 1. 会话管理：无 sessionId 时自动创建
 * 2. 保存用户消息
 * 3. 检索相关片段（Retrieval）
 * 4. 构造 Prompt（Augmented）
 * 5. 流式调用 LLM（Generation）
 * 6. 保存 AI 回答
 */
async *sendMessage(content: string, knowledgeBaseId?: string, sessionId?: string) {
  // ===== 1. 会话管理 =====
  let session: Chat;

  if (sessionId) {
    session = await this.chatRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }
  } else {
    // 自动创建新会话，标题用问题的前 20 个字
    session = this.chatRepository.create({
      title: content.slice(0, 20) + (content.length > 20 ? '...' : ''),
      knowledgeBaseId,
    });
    session = await this.chatRepository.save(session);
  }

  // ===== 2. 保存用户消息 =====
  const userMessage = this.messageRepository.create({
    sessionId: session.id,
    role: 'user',
    content,
  });
  await this.messageRepository.save(userMessage);

  // ===== 3. 检索相关片段（Retrieval） =====
  let contexts: string[] = [];
  let references: string = '';

  if (knowledgeBaseId) {
    const searchResult = await searchSimilar(content, knowledgeBaseId, 5);
    contexts = searchResult.documents;

    // 保存引用信息，后续存到 AI 消息中
    references = JSON.stringify(
      searchResult.documents.map((doc, i) => ({
        content: doc.slice(0, 200),  // 截取前 200 字作为摘要
        metadata: searchResult.metadatas[i],
        score: 1 / (1 + (searchResult.distances[i] || 0)),
      })),
    );
  }

  // ===== 4. 获取历史消息 =====
  const history = await this.messageRepository.find({
    where: { sessionId: session.id },
    order: { createdAt: 'ASC' },
    take: 10,  // 最近 10 条消息作为上下文
  });

  // 转换为 LLM 消息格式（排除 system 角色和当前这条 user 消息）
  const historyMessages = history
    .filter((m) => m.role !== 'system' && m.id !== userMessage.id)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // ===== 5. 构造 Prompt（Augmented）=====
  const messages = buildRAGMessages(contexts, content, historyMessages);

  // ===== 6. 流式调用 LLM（Generation）=====
  let fullResponse = '';

  for await (const chunk of streamChat(messages)) {
    fullResponse += chunk;
    // 每个 chunk 通过 yield 传给 Controller，Controller 再转成 SSE 事件
    yield {
      type: 'chunk',
      data: chunk,
      sessionId: session.id,
    };
  }

  // ===== 7. 保存 AI 完整回答 =====
  const assistantMessage = this.messageRepository.create({
    sessionId: session.id,
    role: 'assistant',
    content: fullResponse,
    references,
  });
  await this.messageRepository.save(assistantMessage);

  // 发送完成事件
  yield {
    type: 'done',
    data: '',
    sessionId: session.id,
  };
}
```

#### 需要在构造函数中注入 messageRepository

```ts
constructor(
  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>,
  @InjectRepository(ChatMessage)                        // 新增
  private readonly messageRepository: Repository<ChatMessage>, // 新增
) {}
```

#### 代码解释

```ts
async *sendMessage(...) {
```
- `async *` 表示这是一个异步 Generator 方法
- 和 `llm.util.ts` 中的 `streamChat` 一样，通过 `yield` 逐个产出数据
- Controller 那边用 `for await` 消费，再转成 SSE 事件

```ts
const history = await this.messageRepository.find({
  where: { sessionId: session.id },
  order: { createdAt: 'ASC' },
  take: 10,
});
```
- 取最近 10 条历史消息作为对话上下文
- 让 AI 知道前面聊了什么，实现**多轮对话**
- `take: 10` 限制条数，避免 token 超限

```ts
references = JSON.stringify(
  searchResult.documents.map((doc, i) => ({ ... })),
);
```
- 把检索到的引用片段存到 AI 消息的 `references` 字段
- 前端可以展示"引用来源"，让用户知道 AI 的回答基于哪些文档

---

### 第 3 步：修改 ChatController — 新增 SSE 流式接口

在 `chat.controller.ts` 中新增 `POST /chat/message` 接口。

#### 新增的 import

```ts
import { Res } from '@nestjs/common';               // 新增
import { Response } from 'express';                   // 新增
import { SendChatMessageDto } from './dto/create-chat.dto'; // 新增
import { ApiBody } from '@nestjs/swagger';            // 新增
```

#### 新增方法

在现有方法的**最前面**加上（放在 `@Post()` 前面，避免路由冲突）：

```ts
@Post('message')
@ApiOperation({ summary: 'RAG 对话（流式输出）' })
@ApiBody({ type: SendChatMessageDto })
@ApiResponse({ status: 200, description: 'SSE 流式返回 AI 回答' })
async sendMessage(
  @Body() dto: SendChatMessageDto,
  @Res() res: Response,
) {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    for await (const event of this.chatService.sendMessage(
      dto.content,
      dto.knowledgeBaseId,
      dto.sessionId,
    )) {
      // SSE 格式：每条消息以 "data: xxx\n\n" 结尾
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
  } finally {
    res.end();
  }
}
```

#### SSE 格式详解

```
SSE 协议要求每条消息的格式：

data: {"type":"chunk","data":"在"}\n\n
data: {"type":"chunk","data":"NestJS"}\n\n
data: {"type":"chunk","data":"中"}\n\n
data: {"type":"done","data":""}\n\n

关键点：
- 每条消息以 "data: " 开头
- 以两个换行符 "\n\n" 结尾
- 内容是 JSON 字符串
```

#### 响应头解释

```ts
res.setHeader('Content-Type', 'text/event-stream');  // 告诉浏览器这是 SSE
res.setHeader('Cache-Control', 'no-cache');           // 不要缓存（实时数据）
res.setHeader('Connection', 'keep-alive');            // 保持连接不断开
res.flushHeaders();                                    // 立即发送响应头
```

#### 为什么用 `@Res()` 而不是 NestJS 的 `@Sse()` 装饰器？

NestJS 提供了 `@Sse()` 装饰器，但它只支持 GET 请求。我们的接口是 POST（发送消息体），所以需要手动设置 SSE 响应头。

---

### 第 4 步：修改 ChatModule — 注册 ChatMessage 实体

`ChatMessage` 实体已经定义好了，但 Module 中没有注册，TypeORM 无法注入 Repository。

#### 修改 `chat.module.ts`

只需在 `TypeOrmModule.forFeature` 中确认包含 `ChatMessage`：

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Chat, ChatMessage } from './entities/chat.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, ChatMessage])],  // ChatMessage 已在数组中
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
```

当前代码已经包含了 `ChatMessage`，确认一下即可。

---

## 完整改动后的文件

### llm.util.ts（新建）

```ts
import * as dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const modelName = process.env.MODEL_NAME || 'deepseek-ai/DeepSeek-V3';

/**
 * 构造 RAG Prompt
 */
export function buildRAGMessages(
  contexts: string[],
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const contextText = contexts
    .map((c, i) => `[${i + 1}] ${c}`)
    .join('\n\n');

  const systemPrompt = `你是一个知识库助手。请根据以下参考资料回答用户的问题。

要求：
1. 只根据参考资料中的内容回答，不要编造信息
2. 如果参考资料中没有相关内容，请明确告知用户
3. 回答时引用资料编号，如 [1]、[2]
4. 使用中文回答，语言简洁清晰

参考资料：
${contextText}`;

  return [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: question },
  ];
}

/**
 * 流式调用 LLM
 */
export async function* streamChat(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): AsyncGenerator<string> {
  const stream = await client.chat.completions.create({
    model: modelName,
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
```

### chat.controller.ts（修改后完整版）

```ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { CreateChatDto, SendChatMessageDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ========== 新增：RAG 对话（放在最前面）==========
  @Post('message')
  @ApiOperation({ summary: 'RAG 对话（流式输出）' })
  @ApiBody({ type: SendChatMessageDto })
  @ApiResponse({ status: 200, description: 'SSE 流式返回 AI 回答' })
  async sendMessage(
    @Body() dto: SendChatMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    try {
      for await (const event of this.chatService.sendMessage(
        dto.content,
        dto.knowledgeBaseId,
        dto.sessionId,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`);
    } finally {
      res.end();
    }
  }

  // ========== 以下是原有的 CRUD 方法，保持不变 ==========

  @Post()
  @ApiOperation({ summary: '创建聊天' })
  @ApiResponse({ status: 201, description: '聊天创建成功' })
  create(@Body() createChatDto: CreateChatDto) {
    return this.chatService.create(createChatDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有聊天' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll() {
    return this.chatService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个聊天' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findOne(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新聊天' })
  @ApiResponse({ status: 200, description: '更新成功' })
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chatService.update(id, updateChatDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除聊天' })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.chatService.remove(id);
  }
}
```

### chat.service.ts（修改后完整版）

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { Chat, ChatMessage } from './entities/chat.entity';
import { Repository } from 'typeorm';
import { searchSimilar } from '../../common/utils/vector-store.util';
import { buildRAGMessages, streamChat } from '../../common/utils/llm.util';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  /**
   * RAG 对话：检索 → 增强 → 生成（流式）
   */
  async *sendMessage(content: string, knowledgeBaseId?: string, sessionId?: string) {
    // 1. 会话管理
    let session: Chat;

    if (sessionId) {
      session = await this.chatRepository.findOne({ where: { id: sessionId } });
      if (!session) {
        throw new Error(`会话 ${sessionId} 不存在`);
      }
    } else {
      session = this.chatRepository.create({
        title: content.slice(0, 20) + (content.length > 20 ? '...' : ''),
        knowledgeBaseId,
      });
      session = await this.chatRepository.save(session);
    }

    // 2. 保存用户消息
    const userMessage = this.messageRepository.create({
      sessionId: session.id,
      role: 'user',
      content,
    });
    await this.messageRepository.save(userMessage);

    // 3. 检索相关片段（Retrieval）
    let contexts: string[] = [];
    let references = '';

    if (knowledgeBaseId) {
      const searchResult = await searchSimilar(content, knowledgeBaseId, 5);
      contexts = searchResult.documents;

      references = JSON.stringify(
        searchResult.documents.map((doc, i) => ({
          content: doc.slice(0, 200),
          metadata: searchResult.metadatas[i],
          score: 1 / (1 + (searchResult.distances[i] || 0)),
        })),
      );
    }

    // 4. 获取历史消息
    const history = await this.messageRepository.find({
      where: { sessionId: session.id },
      order: { createdAt: 'ASC' },
      take: 10,
    });

    const historyMessages = history
      .filter((m) => m.role !== 'system' && m.id !== userMessage.id)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // 5. 构造 Prompt（Augmented）
    const messages = buildRAGMessages(contexts, content, historyMessages);

    // 6. 流式调用 LLM（Generation）
    let fullResponse = '';

    for await (const chunk of streamChat(messages)) {
      fullResponse += chunk;
      yield { type: 'chunk', data: chunk, sessionId: session.id };
    }

    // 7. 保存 AI 完整回答
    const assistantMessage = this.messageRepository.create({
      sessionId: session.id,
      role: 'assistant',
      content: fullResponse,
      references,
    });
    await this.messageRepository.save(assistantMessage);

    yield { type: 'done', data: '', sessionId: session.id };
  }

  // ========== 以下是原有的 CRUD 方法，保持不变 ==========

  create(createChatDto: CreateChatDto) {
    const chat = this.chatRepository.create(createChatDto);
    return this.chatRepository.save(chat);
  }

  findAll() {
    return this.chatRepository.find();
  }

  findOne(id: string) {
    return this.chatRepository.findOne({ where: { id } });
  }

  update(id: string, updateChatDto: UpdateChatDto) {
    return this.chatRepository.update(id, updateChatDto);
  }

  remove(id: string) {
    return this.chatRepository.delete(id);
  }
}
```

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `src/common/utils/llm.util.ts` | **新建** — LLM 调用工具（Prompt 构造 + 流式调用） |
| `src/modules/chat/chat.controller.ts` | **修改** — 新增 `POST /chat/message` SSE 接口 |
| `src/modules/chat/chat.service.ts` | **修改** — 新增 `sendMessage` RAG 对话方法 |
| `src/modules/chat/chat.module.ts` | **确认** — ChatMessage 已注册（无需改动） |
| `package.json` | **修改** — `pnpm add openai` |

---

## 验收测试

### 前置条件

1. ChromaDB 服务在运行（`chroma run`）
2. 之前至少上传过一个文件（向量库中有数据）
3. `.env` 中 `OPENAI_API_KEY` 和 `OPENAI_BASE_URL` 配置正确

### 测试 1：curl 测试流式输出

```bash
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"content": "这个文档讲了什么？", "knowledgeBaseId": "你的知识库ID"}' \
  --no-buffer
```

`--no-buffer` 让 curl 不缓冲输出，你应该能看到内容逐行出现。

### 期望输出

```
data: {"type":"chunk","data":"根据","sessionId":"xxx-xxx"}

data: {"type":"chunk","data":"参考资料","sessionId":"xxx-xxx"}

data: {"type":"chunk","data":"，这个文档","sessionId":"xxx-xxx"}

... （逐字/逐词输出）

data: {"type":"done","data":"","sessionId":"xxx-xxx"}
```

### 测试 2：多轮对话

第一次不传 `sessionId`，记下返回的 `sessionId`，第二次带上它：

```bash
# 第一轮
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"content": "文档的主要内容是什么？", "knowledgeBaseId": "你的KB_ID"}' \
  --no-buffer

# 记下返回的 sessionId，第二轮带上
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"content": "能详细说说第一点吗？", "knowledgeBaseId": "你的KB_ID", "sessionId": "上一轮返回的sessionId"}' \
  --no-buffer
```

第二轮 AI 应该能理解"第一点"是指上一轮回答中的内容。

### 测试 3：不传 knowledgeBaseId（纯对话）

```bash
curl -X POST http://localhost:3000/chat/message \
  -H "Content-Type: application/json" \
  -d '{"content": "你好"}' \
  --no-buffer
```

不传知识库 ID 时，不会检索向量库，AI 会基于自身知识回答（参考资料为空）。

### 测试 4：验证消息持久化

```bash
# 查看所有会话
curl http://localhost:3000/chat | jq .

# 查看某个会话的消息（需要后续实现消息列表接口，当前可查数据库）
```

### 关键验证点

- [ ] 流式输出正常，内容逐字/逐词出现
- [ ] AI 回答基于知识库内容，不是瞎编的
- [ ] 回答中包含引用编号 [1]、[2] 等
- [ ] `sessionId` 正确返回，多轮对话能衔接
- [ ] 会话和消息保存到了数据库

---

## 常见报错速查表

| 报错 | 原因 | 解决 |
|------|------|------|
| `Cannot find module 'openai'` | 没安装 openai SDK | `pnpm add openai` |
| `401 Unauthorized` | API Key 无效 | 检查 `.env` 中的 `OPENAI_API_KEY` |
| `404 model not found` | 模型名写错 | 检查 `.env` 中的 `MODEL_NAME` |
| `Collection not found: kb_xxx` | 知识库没上传过文档 | 先上传文件，或不传 `knowledgeBaseId` 测试纯对话 |
| `Cannot POST /chat/message` | 路由未生效 | 确认 `@Post('message')` 放在 `@Post()` 前面 |
| SSE 没有逐字输出，一次性全返回 | curl 没加 `--no-buffer` | 加上 `--no-buffer` 参数 |
| `Repository not found: ChatMessage` | Module 中没注册 ChatMessage | 确认 `TypeOrmModule.forFeature([Chat, ChatMessage])` |
| `stream is not iterable` | openai SDK 版本太旧 | `pnpm add openai@latest` |
| 回答内容和文档无关 | 检索结果质量差 | 先用第五步的搜索接口测试检索效果 |
| 连接超时 | `OPENAI_BASE_URL` 配置有误 | 检查 URL 是否正确，网络是否可达 |

---

## 知识图谱（这一步你学到了什么）

```
RAG 对话
├── RAG 三步曲
│   ├── Retrieval（检索）— searchSimilar 从向量库找相关片段
│   ├── Augmented（增强）— 把片段塞进 System Prompt 作为上下文
│   └── Generation（生成）— LLM 根据上下文生成回答
│
├── 流式输出
│   ├── SSE（Server-Sent Events）— 服务端→客户端的单向流
│   ├── AsyncGenerator — async function* + yield 逐块产出
│   ├── 响应头设置 — Content-Type: text/event-stream
│   └── 数据格式 — data: {json}\n\n
│
├── OpenAI 兼容接口
│   ├── 国内模型（硅基流动/DeepSeek）都兼容 OpenAI 接口
│   ├── 换 baseURL 就能切换模型提供商
│   └── stream: true 开启流式响应
│
├── 多轮对话
│   ├── sessionId — 标识一个对话会话
│   ├── 历史消息 — 取最近 N 条作为 LLM 的 history
│   └── 上下文窗口 — token 有限，不能无限塞历史
│
└── 在 RAG 系统中的位置
    上传 → 解析 → 切片 → 向量化 → 搜索 → [RAG 对话]
                                           ^^^^^^^^^
                                           你在这里
```

---

## 当前进度

```
第一步：文件上传            ✅
第二步：文件解析            ✅
第三步：文本切片            ✅
第四步：向量化 + ChromaDB   ✅
第五步：语义搜索            ✅
第六步：RAG 对话            ← 你在这里
第七步：对话历史接口（下一步）
```

完成这一步后，你的知识库系统核心链路就**全部跑通**了：上传文档 → 解析切片 → 向量化存储 → 语义搜索 → AI 对话。

下一步可以补充对话历史查看接口（`GET /chat/:sessionId/messages`），让前端能展示历史对话。
