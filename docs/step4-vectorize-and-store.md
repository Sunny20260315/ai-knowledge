# 第四步：向量化 + 存入 ChromaDB

## 目标

把切片后的文本片段转成向量（数字数组），存入 ChromaDB 向量数据库，为后续语义搜索和 RAG 问答做准备。

## 这一步在干什么？

```
"NestJS 是一个后端框架"
        │
        ▼  Embedding 模型（OpenAI text-embedding-ada-002）
        │
        ▼
[0.0023, -0.0142, 0.0381, ..., 0.0091]   ← 1536 维向量
        │
        ▼  存入 ChromaDB
        │
        ▼
用户搜索 "后端框架" → 也转成向量 → 在 ChromaDB 中找最相似的向量 → 返回原文
```

### 什么是向量？

向量就是一组数字，用来表示文本的"语义位置"。

```
"猫"   → [0.21, 0.85, -0.33, ...]
"狗"   → [0.19, 0.82, -0.31, ...]   ← 和"猫"很接近（都是宠物）
"汽车" → [-0.55, 0.12, 0.77, ...]   ← 和"猫"差很远
```

语义相近的文本，向量在空间中的距离也近。这就是语义搜索的原理。

### 什么是 ChromaDB？

一句话：**专门存向量的数据库。**

普通数据库（SQLite/MySQL）擅长精确匹配：`WHERE name = 'xxx'`
向量数据库擅长相似度匹配：**找出和这个向量最接近的 Top-K 个结果**

---

## 前置准备：启动 ChromaDB 服务

ChromaDB 的 JS 客户端（你已安装的 `chromadb@3.4`）需要连接一个 ChromaDB 服务端。

### 方案 A：用 pip 安装（推荐，最简单）

```bash
# 安装 ChromaDB Python 服务端
pip3 install chromadb

# 终极万能命令（解决证书权限我那天，国内镜像）
pip3 install chromadb --trusted-host pypi.tuna.tsinghua.edu.cn --trusted-host files.pythonhosted.org --trusted-host pypi.org --no-cache-dir --timeout 100

# 启动服务（默认在 localhost:8000）
chroma run
```

启动后终端会显示 `Running Chroma`，保持这个终端不要关。

### 方案 B：用 Docker

```bash
docker run -d -p 8000:8000 chromadb/chroma
```

### 验证服务是否运行

```bash
curl http://localhost:8000/api/v1/heartbeat
# 应该返回类似：{"nanosecond heartbeat": 1711929600000}
```

---

## 向量维度详解

### 什么是维度？

一个向量就是一组数字。**维度 = 这组数字有多少个。**

```
"NestJS 是后端框架"
        │
        ▼ Embedding 模型
        │
        ▼
1024 维向量：[0.0277, -0.0213, -0.0451, 0.0078, 0.0003, ..., 0.0091]
              ^^^^^^   ^^^^^^   ^^^^^^   ^^^^^^   ^^^^^^       ^^^^^^
              第1维     第2维     第3维     第4维     第5维   ...  第1024维
```

每一维代表文本在语义空间中某个"方向"上的分量。类比前端：

```
CSS 定位一个元素需要 2 个维度：(x, y)
3D 空间需要 3 个维度：(x, y, z)
语义空间需要 1024 个维度：(d1, d2, d3, ..., d1024)
```

维度越多，能表达的语义越细腻、越精确，但计算量和存储空间也越大。

### 常见 Embedding 模型的维度

| 模型 | 维度 | 提供方 | 特点 |
|------|------|--------|------|
| `BAAI/bge-large-zh-v1.5` | **1024** | 硅基流动（免费） | 中文效果好，你当前在用的 |
| `BAAI/bge-small-zh-v1.5` | 512 | 硅基流动（免费） | 更快更小，精度略低 |
| `text-embedding-ada-002` | 1536 | OpenAI | 经典模型，英文为主 |
| `text-embedding-3-small` | 1536 | OpenAI | 新一代，性价比高 |
| `text-embedding-3-large` | 3072 | OpenAI | 最高精度，最贵 |
| `nomic-embed-text` | 768 | Ollama（本地免费） | 本地运行，无需联网 |
| `Doubao-embedding` | 2560 | 火山引擎（豆包） | 中文优化 |

### 维度高低的区别

```
512 维（小模型）：
  - 速度快，存储小
  - 语义分辨率低，"猫"和"猫咪"可能区分不开
  - 适合：小项目、快速原型

1024 维（中等模型，你当前用的）：
  - 速度和精度平衡
  - 适合：大多数生产场景

3072 维（大模型）：
  - 精度最高，但慢且贵
  - 适合：对精度要求极高的场景（法律、医疗）
```

### 维度不同的模型能混用吗？

**不能。** 存入和搜索必须用同一个模型。

```
❌ 错误：用 bge-large（1024维）存入，用 ada-002（1536维）搜索
  → ChromaDB 会报错：向量维度不匹配

✅ 正确：存入和搜索都用 bge-large（1024维）
```

这就是为什么你的 `vector-store.util.ts` 中存入（`embedDocuments`）和搜索（`embedQuery`）用的是同一个 `embeddings` 实例。

### 如何查看自己的向量维度

#### 方法 1：代码查看

```ts
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({ ... });
const vector = await embeddings.embedQuery('测试文本');
console.log('维度:', vector.length);    // 输出：1024
console.log('前5个值:', vector.slice(0, 5));
```

#### 方法 2：curl 查看

```bash
# 调硅基流动 API，看返回的 embedding 数组长度
curl -s https://api.siliconflow.cn/v1/embeddings \
  -H "Authorization: Bearer 你的KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "BAAI/bge-large-zh-v1.5", "input": "测试"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('维度:', len(d['data'][0]['embedding']))"
```

#### 方法 3：查看 ChromaDB collection 的维度

```bash
curl -s "http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
for c in data:
    print(f\"{c['name']}: dimension={c.get('dimension', 'unknown')}\")
"
```

你的当前配置：`BAAI/bge-large-zh-v1.5`，维度 = **1024**。

---

## 实现步骤

### 第 1 步：在 .env 中添加配置

在 `backend/.env` 中添加：

```env
# ChromaDB 配置
CHROMA_HOST=http://localhost:8000

# OpenAI Embedding 配置（你已有的 OPENAI_API_KEY 就够了）
# 如果用国内代理/其他 API，加这行：
# OPENAI_BASE_URL=https://api.your-proxy.com/v1
```

### 第 2 步：新建向量存储工具

新建文件：`src/common/utils/vector-store.util.ts`

这个文件负责两件事：
1. 把文本片段转成向量（调用 OpenAI Embedding API）
2. 把向量存入 ChromaDB

#### 完整代码

```ts
// src/common/utils/vector-store.util.ts

import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';

// ==================== 初始化 ====================

/**
 * ChromaDB 客户端
 * 连接到本地运行的 ChromaDB 服务（默认 localhost:8000）
 */
const chromaClient = new ChromaClient({
  host: process.env.CHROMA_HOST || 'http://localhost:8000',
});

/**
 * OpenAI Embedding 模型
 * 把文本转成 1536 维的向量
 *
 * 需要 .env 中配置 OPENAI_API_KEY
 * 如果用代理，需要配置 OPENAI_BASE_URL
 */
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
  // 如果用代理，取消下面这行注释：
  // configuration: { baseURL: process.env.OPENAI_BASE_URL },
});

// ==================== 核心函数 ====================

/**
 * 将文本片段向量化并存入 ChromaDB
 *
 * @param chunks - 切片后的文本数组（来自 splitText 的输出）
 * @param knowledgeBaseId - 知识库 ID（每个知识库对应一个 ChromaDB collection）
 * @param documentId - 文档 ID（用于标记每个向量来自哪个文档）
 * @param fileName - 文件名（存为元数据，方便后续溯源）
 */
export async function storeChunks(
  chunks: string[],
  knowledgeBaseId: string,
  documentId: string,
  fileName: string,
): Promise<void> {
  // 1. 获取或创建 collection（每个知识库一个 collection）
  //    collection 类似于关系数据库中的"表"
  const collection = await chromaClient.getOrCreateCollection({
    name: `kb_${knowledgeBaseId}`,
  });

  // 2. 批量生成向量
  //    把所有文本片段一次性发给 OpenAI，返回对应的向量数组
  const vectors = await embeddings.embedDocuments(chunks);

  // 3. 准备存入 ChromaDB 的数据
  //    每个片段需要：id、向量、原文、元数据
  const ids = chunks.map((_, i) => `${documentId}_chunk_${i}`);
  const metadatas = chunks.map((_, i) => ({
    documentId,
    fileName,
    chunkIndex: i,
    knowledgeBaseId,
  }));

  // 4. 批量写入 ChromaDB
  await collection.add({
    ids,                    // 每个向量的唯一 ID
    embeddings: vectors,    // 向量数组（每个是 1536 维的 number[]）
    documents: chunks,      // 原始文本（用于搜索后返回给用户）
    metadatas,              // 元数据（用于过滤和溯源）
  });
}

/**
 * 删除某个文档的所有向量
 * 用于文档删除或重新上传时清理旧数据
 *
 * @param knowledgeBaseId - 知识库 ID
 * @param documentId - 文档 ID
 */
export async function deleteDocumentChunks(
  knowledgeBaseId: string,
  documentId: string,
): Promise<void> {
  try {
    const collection = await chromaClient.getCollection({
      name: `kb_${knowledgeBaseId}`,
    });
    await collection.delete({
      where: { documentId },
    });
  } catch {
    // collection 不存在时忽略错误
  }
}

/**
 * 语义搜索：根据查询文本，在指定知识库中搜索最相关的片段
 * （第五步 RAG 问答时会用到，这里先写好）
 *
 * @param query - 用户的搜索/提问文本
 * @param knowledgeBaseId - 知识库 ID
 * @param topK - 返回最相关的前 K 个结果，默认 5
 * @returns 搜索结果数组
 */
export async function searchSimilar(
  query: string,
  knowledgeBaseId: string,
  topK = 5,
): Promise<{
  documents: string[];
  metadatas: Record<string, unknown>[];
  distances: number[];
}> {
  const collection = await chromaClient.getCollection({
    name: `kb_${knowledgeBaseId}`,
  });

  // 把查询文本也转成向量
  const queryVector = await embeddings.embedQuery(query);

  // 在 ChromaDB 中找最相似的 topK 个向量
  const results = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: topK,
  });

  return {
    documents: (results.documents?.[0] || []) as string[],
    metadatas: (results.metadatas?.[0] || []) as Record<string, unknown>[],
    distances: (results.distances?.[0] || []) as number[],
  };
}
```

#### 逐块解释

**初始化部分**

```ts
const chromaClient = new ChromaClient({
  host: process.env.CHROMA_HOST || 'http://localhost:8000',
});
```
- 创建 ChromaDB 客户端，连接到本地服务
- 类比：就像 `new TypeORM.DataSource({ host: 'localhost' })` 连接 SQLite

```ts
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-ada-002',
});
```
- 创建 OpenAI Embedding 模型实例
- `text-embedding-ada-002` 是 OpenAI 最常用的嵌入模型，每次调用把文本转成 1536 维向量
- 每次调用会消耗 OpenAI API 额度（很便宜，$0.0001/1K tokens）

**storeChunks 函数**

```ts
const collection = await chromaClient.getOrCreateCollection({
  name: `kb_${knowledgeBaseId}`,
});
```
- Collection = ChromaDB 中的"表"
- 每个知识库对应一个 collection：`kb_abc123`、`kb_def456`
- `getOrCreateCollection`：有就用，没有就创建

```ts
const vectors = await embeddings.embedDocuments(chunks);
```
- 核心一行：把所有文本片段批量转成向量
- 输入：`['片段1文本', '片段2文本', ...]`
- 输出：`[[0.001, -0.023, ...], [0.015, 0.008, ...], ...]`
- 这里会调用 OpenAI API，所以需要网络和有效的 API Key

```ts
await collection.add({
  ids,           // ['docId_chunk_0', 'docId_chunk_1', ...]
  embeddings,    // [[0.001, ...], [0.015, ...], ...]
  documents,     // ['原文片段1', '原文片段2', ...]
  metadatas,     // [{documentId, fileName, chunkIndex}, ...]
});
```
- 把向量、原文、元数据一起存入 ChromaDB
- `ids`：每个向量的唯一标识，格式 `{documentId}_chunk_{index}`
- `documents`：保留原文，搜索命中后能直接返回给用户
- `metadatas`：附加信息，用于过滤（比如只搜某个文档）和溯源（知道这段话来自哪个文件）

**searchSimilar 函数**（预留给后续搜索/RAG 用）

```ts
const queryVector = await embeddings.embedQuery(query);
```
- 把用户的问题也转成向量

```ts
const results = await collection.query({
  queryEmbeddings: [queryVector],
  nResults: topK,
});
```
- 在 ChromaDB 中执行相似度搜索
- 返回最接近的 topK 个片段（默认 5 个）
- ChromaDB 内部用余弦相似度/欧氏距离计算

---

### 第 3 步：修改 Service — 在切片后加入向量化

改造 `document.service.ts`。

#### 新增的 import

```ts
import { storeChunks } from '../../common/utils/vector-store.util';
```

注意：如果你之前用的是 `from 'src/common/...'`，这里保持一致即可。

#### 在切片之后、更新状态之前加入向量化

```ts
async createFromUpload(file: Express.Multer.File, knowledgeBaseId: string) {
  const ext = file.originalname.split('.').pop();

  // ========== 阶段1：保存上传记录 ==========
  const documentParse = this.documentParseRepository.create({
    fileName: file.originalname,
    filePath: file.path,
    fileType: ext,
    fileSize: String(file.size),
    knowledgeBaseId,
    chunkCount: '0',
    status: 'uploaded',
  });
  const saved = await this.documentParseRepository.save(documentParse);

  try {
    // ========== 阶段2：解析文件提取文本 ==========
    await this.documentParseRepository.update(saved.id, { status: 'parsing' });
    const text = await parseFile(file.path, ext as string);
    console.log(`[解析完成] 文件: ${file.originalname}, 文本长度: ${text.length} 字符`);

    // ========== 阶段3：文本切片 ==========
    await this.documentParseRepository.update(saved.id, { status: 'splitting' });
    const chunks = await splitText(text as string);
    console.log(`[切片完成] 文件: ${file.originalname}, 共 ${chunks.length} 个片段`);

    // ========== 阶段4：向量化 + 存入 ChromaDB ==========
    await this.documentParseRepository.update(saved.id, { status: 'embedding' });
    await storeChunks(chunks, knowledgeBaseId, saved.id, file.originalname);
    console.log(`[向量化完成] 文件: ${file.originalname}, ${chunks.length} 个片段已存入 ChromaDB`);

    // ========== 全部完成 ==========
    await this.documentParseRepository.update(saved.id, {
      chunkCount: String(chunks.length),
      status: 'done',
    });
  } catch (error) {
    console.error(`[处理失败] 文件: ${file.originalname}`, error);
    await this.documentParseRepository.update(saved.id, { status: 'failed' });
  }

  return this.documentParseRepository.findOne({ where: { id: saved.id } });
}
```

#### 状态流转（完整版）

```
uploaded → parsing → splitting → embedding → done
                                               │
        任何阶段出错 ──────────────────────→ failed
```

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `backend/.env` | **修改** — 添加 CHROMA_HOST 配置 |
| `src/common/utils/vector-store.util.ts` | **新建** — 向量化 + ChromaDB 存储工具 |
| `src/modules/document/document.service.ts` | **修改** — createFromUpload 加入向量化逻辑 |

---

## 验收测试

### 前置条件

1. ChromaDB 服务已启动（`chroma run` 或 Docker）
2. `.env` 中的 `OPENAI_API_KEY` 是有效的

### 测试 1：完整上传流程

上传一个 TXT/PDF 文件，观察终端输出：

```
[解析完成] 文件: readme.txt, 文本长度: 2500 字符
[切片完成] 文件: readme.txt, 共 3 个片段
[向量化完成] 文件: readme.txt, 3 个片段已存入 ChromaDB
```

接口返回：
```json
{
  "status": "done",
  "chunkCount": "3"
}
```

### 测试 2：验证向量已存入 ChromaDB

```bash
# 查看 ChromaDB 中的 collections
curl http://localhost:8000/api/v1/collections

# 应该能看到名为 kb_{knowledgeBaseId} 的 collection
```

### 测试 3：API Key 无效时

把 `.env` 中的 OPENAI_API_KEY 改成错的，上传文件：
- 应该返回 `status: "failed"`
- 终端打印 OpenAI 认证错误
- 服务不崩溃

---

## 实战踩坑记录

### 坑 1：ChromaDB 连接失败 — 参数名写错

**报错**：
```
ChromaConnectionError: Failed to connect to chromadb.
```

**排查过程**：ChromaDB 服务明明在跑（`chroma run` 显示 Running），`curl http://localhost:8000/api/v2/heartbeat` 也正常，但代码连不上。

**原因**：`chromadb@3.4` 的 `ChromaClient` 构造函数参数名不是 `host`，而是 `baseUrl`。

```ts
// ❌ 错误写法
const chromaClient = new ChromaClient({
  host: 'http://localhost:8000',
});

// ✅ 正确写法（但 TypeScript 类型定义里没声明 baseUrl，会报类型错误）
const chromaClient = new ChromaClient({
  baseUrl: 'http://localhost:8000',
});

// ✅✅ 最佳写法：默认就是 localhost:8000，直接不传参数
const chromaClient = new ChromaClient();
```

**教训**：第三方库的构造函数参数名不确定时，看类型定义或直接测试，不要凭经验猜。

---

### 坑 2：401 认证失败 — 请求发到了 OpenAI 而不是硅基流动

**报错**：
```
AuthenticationError: 401 Incorrect API key provided: sk-uvwhu***vxqx.
You can find your API key at https://platform.openai.com/account/api-keys.
```

**排查过程**：看 response headers 中的 `Domain=api.openai.com`，发现请求发到了 OpenAI 而不是硅基流动。

**原因**：`OpenAIEmbeddings` 的 `configuration.baseURL` 写了，但值是 `process.env.OPENAI_BASE_URL`，而这个环境变量在代码执行时还没被加载。

```ts
// 代码初始化时 process.env.OPENAI_BASE_URL 是 undefined
const embeddings = new OpenAIEmbeddings({
  configuration: { baseURL: process.env.OPENAI_BASE_URL }, // ← undefined!
});
// baseURL 为 undefined 时，默认回退到 api.openai.com
```

**根本原因**：`vector-store.util.ts` 在模块顶层初始化变量，这发生在 NestJS 的 `ConfigModule.forRoot()` 加载 `.env` 之前。时序问题：

```
1. Node.js 开始加载模块
2. vector-store.util.ts 顶层代码执行 → new OpenAIEmbeddings() → 此时 .env 还没加载
3. NestJS 启动 → ConfigModule.forRoot() 加载 .env → 但已经晚了
```

**解决**：在 `vector-store.util.ts` 最顶部手动调用 `dotenv.config()`：

```ts
import * as dotenv from 'dotenv';
dotenv.config(); // 在任何 process.env 读取之前加载 .env

import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
// 现在 process.env.OPENAI_BASE_URL 有值了
```

**教训**：在 NestJS 中，模块顶层初始化的代码（不在 class 构造函数里的）会在 `ConfigModule` 之前执行。如果顶层代码依赖环境变量，必须手动 `dotenv.config()` 或改为延迟初始化。

---

### 坑 3：400 错误 — 请求到了硅基流动但返回错误

**报错**：
```
status: 400
headers: { 'x-siliconcloud-trace-id': 'ti_ynzaagf0c2r8c1g7jn' }
```

**排查过程**：
1. 看到 `x-siliconcloud-trace-id`，确认请求已经发到了硅基流动（不再是 OpenAI）
2. 400 = 请求参数有问题
3. 直接用 curl 测试硅基流动 API → 成功 → 说明 key 和模型名没问题
4. 问题出在 `OpenAIEmbeddings` 发送的请求格式和硅基流动的预期有细微差异

**原因**：这个 400 实际上是坑 2 没完全修好导致的。`dotenv.config()` 加上后，`baseURL` 读到了正确的值，400 也随之消失。

---

### 坑 4：ChromaDB v2 API 变更

**现象**：按网上教程用 `curl http://localhost:8000/api/v1/heartbeat` 测试 ChromaDB，返回：

```json
{"error": "Unimplemented", "message": "The v1 API is deprecated. Please use /v2 apis"}
```

**原因**：新版 ChromaDB 已废弃 v1 API，改为 v2。

**解决**：
```bash
# v1（已废弃）
curl http://localhost:8000/api/v1/heartbeat

# v2（正确）
curl http://localhost:8000/api/v2/heartbeat
```

代码中不需要改，`chromadb@3.4` JS 客户端会自动用正确的 API 版本。

---

## 常见报错速查表

| 报错 | 原因 | 解决 |
|------|------|------|
| `Failed to connect to chromadb` | ChromaDB 服务没启动，或参数名错误 | 先 `chroma run`，然后用 `new ChromaClient()`（不传参数） |
| `Incorrect API key provided` | 请求发到了 OpenAI 而不是硅基流动 | 检查 `dotenv.config()` 是否在最顶部，`baseURL` 是否生效 |
| `401` + `api.openai.com` | `process.env.OPENAI_BASE_URL` 为 undefined | 在文件顶部加 `import * as dotenv from 'dotenv'; dotenv.config();` |
| `400` + `x-siliconcloud-trace-id` | 请求到了硅基流动但参数有问题 | 用 curl 直接测试 API 确认 key 和模型名是否正确 |
| `Rate limit exceeded` | API 调用频率太高 | 等一会再试，或升级套餐 |
| `Cannot find module 'chromadb'` | 包没装 | `cd backend && pnpm add chromadb` |
| `ECONNREFUSED 127.0.0.1:8000` | ChromaDB 端口不对或没启动 | 检查 `CHROMA_HOST` 配置和 `chroma run` 状态 |
| `Collection not found` | collection 名字不对 | 检查 `kb_${knowledgeBaseId}` 的拼接 |
| `v1 API is deprecated` | ChromaDB 新版废弃了 v1 API | 用 `/api/v2/` 路径，JS 客户端会自动处理 |

---

## ChromaDB 中的数据结构

存入后，ChromaDB 中的数据长这样：

```
Collection: kb_abc123（知识库 ID）
┌──────────────────────┬─────────────────┬──────────────────┬─────────────────────┐
│ id                   │ embedding       │ document         │ metadata            │
├──────────────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ doc001_chunk_0       │ [0.001, -0.02,  │ "NestJS 是一个..." │ {documentId: "doc001", │
│                      │  0.038, ...]    │                  │  fileName: "readme.txt",│
│                      │                 │                  │  chunkIndex: 0}      │
├──────────────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ doc001_chunk_1       │ [0.015, 0.008,  │ "TypeORM 支持..." │ {documentId: "doc001", │
│                      │  -0.011, ...]   │                  │  fileName: "readme.txt",│
│                      │                 │                  │  chunkIndex: 1}      │
├──────────────────────┼─────────────────┼──────────────────┼─────────────────────┤
│ doc002_chunk_0       │ [-0.055, 0.12,  │ "React 是一个..." │ {documentId: "doc002", │
│                      │  0.077, ...]    │                  │  fileName: "react.pdf", │
│                      │                 │                  │  chunkIndex: 0}      │
└──────────────────────┴─────────────────┴──────────────────┴─────────────────────┘
```

---

## ChromaDB 查询方法（curl 命令）

ChromaDB 没有自带的 GUI 管理界面，用 curl 直接调 REST API 查看数据。

### 基础路径

所有 API 的基础路径是：

```
http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database
```

下面简称为 `BASE_URL`。

### 1. 检查服务是否运行

```bash
curl -s http://localhost:8000/api/v2/heartbeat
# 返回：{"nanosecond heartbeat": 1775095825760455000}
```

### 2. 查看所有 collections（相当于"查看所有表"）

```bash
curl -s "http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections" | python3 -m json.tool
```

返回值中关注 `name` 和 `id` 字段：
- `name`：collection 名称，格式 `kb_{knowledgeBaseId}`
- `id`：后续查询需要用到的 UUID

### 3. 查看某个 collection 有多少条记录

```bash
# 把 COLLECTION_ID 替换成第 2 步拿到的 id
curl -s "http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections/COLLECTION_ID/count"
# 返回：5（表示有 5 个向量片段）
```

### 4. 查看 collection 中的具体内容

```bash
curl -s -X POST \
  "http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections/COLLECTION_ID/get" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "include": ["documents", "metadatas"]}' \
  | python3 -m json.tool
```

返回示例：
```json
{
  "ids": ["doc001_chunk_0", "doc001_chunk_1"],
  "documents": [
    "NestJS 是一个后端框架...",
    "TypeORM 支持多种数据库..."
  ],
  "metadatas": [
    {"documentId": "doc001", "fileName": "readme.txt", "chunkIndex": 0},
    {"documentId": "doc001", "fileName": "readme.txt", "chunkIndex": 1}
  ]
}
```

`include` 参数控制返回哪些字段：
- `"documents"` — 原始文本
- `"metadatas"` — 元数据
- `"embeddings"` — 向量（很长，一般不需要看）

### 5. 删除整个 collection

```bash
curl -s -X DELETE \
  "http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database/collections/COLLECTION_NAME"
# 把 COLLECTION_NAME 替换成 collection 的名称（如 kb_string）
```

### 快捷脚本

可以在项目根目录创建一个 `scripts/chroma-inspect.sh`，方便日常查看：

```bash
#!/bin/bash
BASE="http://localhost:8000/api/v2/tenants/default_tenant/databases/default_database"

echo "=== Collections ==="
curl -s "$BASE/collections" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for c in data:
    print(f\"  {c['name']} (id: {c['id']})\")
"

echo ""
echo "=== 输入 collection id 查看内容（直接回车跳过）==="
read -r CID
if [ -n "$CID" ]; then
  echo "--- count ---"
  curl -s "$BASE/collections/$CID/count"
  echo ""
  echo "--- documents ---"
  curl -s -X POST "$BASE/collections/$CID/get" \
    -H "Content-Type: application/json" \
    -d '{"limit": 5, "include": ["documents", "metadatas"]}' \
    | python3 -m json.tool
fi
```

使用：`bash scripts/chroma-inspect.sh`

---

## 知识图谱（这一步你学到了什么）

```
向量化 + 向量存储
├── 向量（Embedding）
│   ├── 文本 → 数字数组（1536 维）
│   ├── 语义相近的文本 → 向量距离近
│   └── OpenAI text-embedding-ada-002 模型
│
├── ChromaDB（向量数据库）
│   ├── Collection = 表（每个知识库一个）
│   ├── add() = 插入向量 + 原文 + 元数据
│   ├── query() = 相似度搜索（余弦距离）
│   └── delete() = 删除向量
│
├── 数据流
│   切片文本 → OpenAI Embedding → 向量 → ChromaDB 存储
│
└── 在 RAG 系统中的位置
    解析 → 切片 → [向量化 + 存储] → 检索 → 生成回答
                    ^^^^^^^^^^^^^^^
                      你在这里
```

---

## 当前进度

```
第一步：文件上传         ✅
第二步：文件解析         ✅
第三步：文本切片         ✅
第四步：向量化 + ChromaDB  ← 你在这里
第五步：串联完整流程      （已在本步完成串联）
```

完成这一步后，**文档上传的完整链路就跑通了**：

```
用户上传文件 → 解析文本 → 切片 → 向量化 → 存入 ChromaDB → done ✅
```

下一个大目标是：实现语义搜索和 RAG 对话（用户提问 → 检索相关片段 → AI 生成回答）。
