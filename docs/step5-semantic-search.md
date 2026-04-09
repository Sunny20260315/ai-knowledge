# 第五步：语义搜索接口

## 目标

实现 `GET /search/query?q=xxx&knowledgeBaseId=xxx` 接口，用户输入关键词或问题，从向量库中找到最相关的文档片段返回。

## 这一步在干什么？

```
用户输入: "NestJS 怎么配置数据库？"
         │
         ▼ Embedding 模型（和存入时用同一个）
         │
         ▼
  查询向量: [0.015, -0.023, 0.041, ...]
         │
         ▼ ChromaDB 相似度搜索
         │
         ▼
  找到最相似的 5 个片段:
  ┌─────────────────────────────────────────────┬──────────┐
  │ 片段内容                                      │ 相似度    │
  ├─────────────────────────────────────────────┼──────────┤
  │ "TypeORM 是 NestJS 中最常用的 ORM 框架..."      │ 0.92     │
  │ "在 app.module.ts 中配置 TypeOrmModule..."     │ 0.87     │
  │ "数据库连接需要在 .env 中设置..."                 │ 0.83     │
  └─────────────────────────────────────────────┴──────────┘
```

### 语义搜索 vs 关键词搜索

```
关键词搜索（传统 SQL LIKE）：
  搜索 "数据库配置" → 只能找到包含"数据库配置"这四个字的文档
  搜 "DB setup" → 找不到中文文档

语义搜索（向量相似度）：
  搜索 "数据库配置" → 能找到包含"TypeORM连接"、"数据源设置"的文档
  搜 "DB setup" → 也能找到中文的数据库配置文档
  因为它们的语义（向量）是接近的
```

---

## 实现步骤

### 核心调用链

`searchSimilar` 函数在第四步已经写好了（`vector-store.util.ts`），这一步只需要：

1. 在 Controller 新增一个搜索接口
2. 在 Service 中调用 `searchSimilar` 并记录搜索历史

```
Controller（接收请求）→ Service（调用搜索 + 记录历史）→ searchSimilar（ChromaDB 查询）
```

---

### 第 1 步：修改 Controller — 新增语义搜索接口

在 `search.controller.ts` 中新增一个 `search` 方法。

#### 新增的 import

```ts
import { Query } from '@nestjs/common';  // 加到已有的 import 中
import { ApiQuery } from '@nestjs/swagger'; // 加到已有的 import 中
```

#### 新增方法

在现有方法的**最前面**加上这个搜索方法（放在 `@Post()` 前面，避免路由冲突）：

```ts
@Get('query')
@ApiOperation({ summary: '语义搜索' })
@ApiQuery({ name: 'q', description: '搜索关键词或问题', required: true })
@ApiQuery({ name: 'knowledgeBaseId', description: '知识库ID', required: true })
@ApiQuery({ name: 'topK', description: '返回结果数量', required: false })
@ApiResponse({ status: 200, description: '搜索成功' })
async search(
  @Query('q') q: string,
  @Query('knowledgeBaseId') knowledgeBaseId: string,
  @Query('topK') topK?: string,
) {
  if (!q || !knowledgeBaseId) {
    throw new BadRequestException('参数 q 和 knowledgeBaseId 必填');
  }
  return this.searchService.semanticSearch(
    q,
    knowledgeBaseId,
    topK ? parseInt(topK, 10) : 5,
  );
}
```

别忘了在 import 中加上 `BadRequestException`：

```ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,                  // 新增
  BadRequestException,    // 新增
} from '@nestjs/common';
```

以及 Swagger 装饰器：

```ts
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';  // 加 ApiQuery
```

#### 装饰器说明

| 装饰器 | 作用 |
|--------|------|
| `@Get('query')` | 路由：`GET /search/query?q=xxx&knowledgeBaseId=xxx` |
| `@ApiQuery({ name: 'q' })` | 让 Swagger UI 显示查询参数输入框 |
| `@Query('q')` | 从 URL 的 query string 中提取 `q` 参数 |

为什么用 `@Get('query')` 而不是直接 `@Get()`？因为 `@Get()` 已经被 `findAll` 占用了，加个子路径区分。

---

### 第 2 步：修改 Service — 新增 semanticSearch 方法

在 `search.service.ts` 中新增方法。

#### 新增的 import

```ts
import { searchSimilar } from '../../common/utils/vector-store.util';
```

注意：如果你项目中其他文件用的是 `from 'src/common/...'`，这里保持一致。

#### 新增方法

在 `SearchService` 类中加一个 `semanticSearch` 方法：

```ts
/**
 * 语义搜索
 * 1. 调用 ChromaDB 搜索最相关的片段
 * 2. 记录搜索历史到数据库
 * 3. 返回搜索结果
 */
async semanticSearch(query: string, knowledgeBaseId: string, topK = 5) {
  const startTime = Date.now();

  // 1. 调用向量搜索
  const searchResult = await searchSimilar(query, knowledgeBaseId, topK);

  const executionTime = Date.now() - startTime;

  // 2. 格式化结果
  const formattedResults = searchResult.documents.map((doc, i) => ({
    content: doc,                              // 片段原文
    metadata: searchResult.metadatas[i],       // 元数据（来源文件等）
    distance: searchResult.distances[i],       // 距离（越小越相似）
    score: 1 - (searchResult.distances[i] || 0), // 相似度分数（越大越相似）
  }));

  // 3. 记录搜索历史到数据库
  const searchRecord = this.searchRepository.create({
    query,
    knowledgeBaseId,
    results: JSON.stringify(formattedResults),
    resultCount: formattedResults.length,
    executionTime,
  });
  await this.searchRepository.save(searchRecord);

  // 4. 返回结果
  return {
    query,
    knowledgeBaseId,
    resultCount: formattedResults.length,
    executionTime: `${executionTime}ms`,
    results: formattedResults,
  };
}
```

#### 代码解释

```ts
const startTime = Date.now();
// ... 执行搜索 ...
const executionTime = Date.now() - startTime;
```
- 计算搜索耗时，方便后续做性能监控

```ts
const formattedResults = searchResult.documents.map((doc, i) => ({
  content: doc,
  metadata: searchResult.metadatas[i],
  distance: searchResult.distances[i],
  score: 1 - (searchResult.distances[i] || 0),
}));
```
- `distance`：ChromaDB 返回的距离值，越小表示越相似
- `score`：转换成相似度分数，`1 - distance`，越大表示越相似（更直观）
- `metadata`：包含 `documentId`、`fileName`、`chunkIndex`，可以溯源到原文件

```ts
const searchRecord = this.searchRepository.create({ ... });
await this.searchRepository.save(searchRecord);
```
- 每次搜索都记录到 `search_history` 表
- 后续可以做搜索分析（热门搜索词、搜索趋势等）

---

### 完整改动后的文件

#### search.controller.ts

```ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('搜索')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // ========== 新增：语义搜索（放在最前面）==========
  @Get('query')
  @ApiOperation({ summary: '语义搜索' })
  @ApiQuery({ name: 'q', description: '搜索关键词或问题', required: true })
  @ApiQuery({ name: 'knowledgeBaseId', description: '知识库ID', required: true })
  @ApiQuery({ name: 'topK', description: '返回结果数量', required: false })
  @ApiResponse({ status: 200, description: '搜索成功' })
  async search(
    @Query('q') q: string,
    @Query('knowledgeBaseId') knowledgeBaseId: string,
    @Query('topK') topK?: string,
  ) {
    if (!q || !knowledgeBaseId) {
      throw new BadRequestException('参数 q 和 knowledgeBaseId 必填');
    }
    return this.searchService.semanticSearch(
      q,
      knowledgeBaseId,
      topK ? parseInt(topK, 10) : 5,
    );
  }

  // ========== 以下是原有的 CRUD 方法，保持不变 ==========

  @Post()
  @ApiOperation({ summary: '创建搜索' })
  @ApiResponse({ status: 201, description: '搜索已创建' })
  create(@Body() createSearchDto: CreateSearchDto) {
    return this.searchService.create(createSearchDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有搜索' })
  @ApiResponse({ status: 200, description: '返回所有搜索' })
  findAll() {
    return this.searchService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取搜索' })
  @ApiResponse({ status: 200, description: '返回搜索' })
  findOne(@Param('id') id: string) {
    return this.searchService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新搜索' })
  @ApiResponse({ status: 200, description: '搜索已更新' })
  update(@Param('id') id: string, @Body() updateSearchDto: UpdateSearchDto) {
    return this.searchService.update(id, updateSearchDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除搜索' })
  @ApiResponse({ status: 200, description: '搜索已删除' })
  remove(@Param('id') id: string) {
    return this.searchService.remove(id);
  }
}
```

#### search.service.ts

```ts
import { Injectable } from '@nestjs/common';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchEntity } from './entities/search.entity';
import { searchSimilar } from '../../common/utils/vector-store.util';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(SearchEntity)
    private readonly searchRepository: Repository<SearchEntity>,
  ) {}

  /**
   * 语义搜索
   */
  async semanticSearch(query: string, knowledgeBaseId: string, topK = 5) {
    const startTime = Date.now();

    // 1. 调用向量搜索
    const searchResult = await searchSimilar(query, knowledgeBaseId, topK);

    const executionTime = Date.now() - startTime;

    // 2. 格式化结果
    const formattedResults = searchResult.documents.map((doc, i) => ({
      content: doc,
      metadata: searchResult.metadatas[i],
      distance: searchResult.distances[i],
      score: 1 / (1 + (searchResult.distances[i] || 0)),
    }));

    // 3. 记录搜索历史
    const searchRecord = this.searchRepository.create({
      query,
      knowledgeBaseId,
      results: JSON.stringify(formattedResults),
      resultCount: formattedResults.length,
      executionTime,
    });
    await this.searchRepository.save(searchRecord);

    // 4. 返回结果
    return {
      query,
      knowledgeBaseId,
      resultCount: formattedResults.length,
      executionTime: `${executionTime}ms`,
      results: formattedResults,
    };
  }

  // ========== 以下是原有的 CRUD 方法，保持不变 ==========

  create(createSearchDto: CreateSearchDto) {
    const search = this.searchRepository.create(createSearchDto);
    return this.searchRepository.save(search);
  }

  findAll() {
    return this.searchRepository.find();
  }

  findOne(id: string) {
    return this.searchRepository.findOne({ where: { id } });
  }

  update(id: string, updateSearchDto: UpdateSearchDto) {
    return this.searchRepository.update(id, updateSearchDto);
  }

  remove(id: string) {
    return this.searchRepository.delete(id);
  }
}
```

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `src/modules/search/search.controller.ts` | **修改** — 新增 `GET /search/query` 语义搜索接口 |
| `src/modules/search/search.service.ts` | **修改** — 新增 `semanticSearch` 方法 |

不需要新建文件，因为 `searchSimilar` 已经在第四步写好了。

---

## 验收测试

### 前置条件

1. ChromaDB 服务在运行
2. 之前至少上传过一个文件（`status: "done"`），向量库中有数据

### 测试 1：Swagger 测试

1. 打开 `http://localhost:3000/api`
2. 找到 `GET /search/query`
3. 填入参数：
   - `q`：一个和你上传文档内容相关的问题
   - `knowledgeBaseId`：上传文件时填的知识库 ID
4. 点击 Execute

### 测试 2：curl 测试

```bash
# 把 YOUR_KB_ID 替换成你实际的知识库 ID
curl -s "http://localhost:3000/search/query?q=你的搜索问题&knowledgeBaseId=YOUR_KB_ID" | jq .
```

### 期望返回

```json
{
  "query": "数据库怎么配置",
  "knowledgeBaseId": "kb-001",
  "resultCount": 3,
  "executionTime": "523ms",
  "results": [
    {
      "content": "在 app.module.ts 中通过 TypeOrmModule.forRoot() 配置数据库连接...",
      "metadata": {
        "documentId": "doc-xxx",
        "fileName": "nestjs教程.pdf",
        "chunkIndex": 2,
        "knowledgeBaseId": "kb-001"
      },
      "distance": 0.15,
      "score": 0.85
    },
    {
      "content": "数据库支持 SQLite、PostgreSQL、MySQL 等多种类型...",
      "metadata": { ... },
      "distance": 0.23,
      "score": 0.77
    }
  ]
}
```

**关键验证点**：
- [ ] `results` 数组不为空，返回了相关片段
- [ ] `content` 内容和你的搜索词语义相关（不是随机的）
- [ ] `score` 越高的排在前面
- [ ] `metadata` 中有来源文件名，能溯源
- [ ] `executionTime` 在合理范围（通常 200ms~2000ms）

### 测试 3：搜索不相关的内容

搜索一个文档中完全不存在的话题（比如文档是技术文档，你搜"今天天气怎么样"），看看返回的 `score` 是否明显偏低（低于 0.5）。

### 测试 4：搜索历史

调用 `GET /search` 查看搜索历史列表，确认刚才的搜索已经被记录。

---

## distance 和 score 详解

### distance（距离）

ChromaDB 返回的原始指标，表示查询向量和文档向量之间的距离。**越小越相似。**

ChromaDB 支持三种距离算法：

| 算法 | 范围 | ChromaDB 默认 |
|------|------|--------------|
| **L2（欧氏距离）** | `0 ~ 无穷大` | **是** ← 你当前用的 |
| Cosine（余弦距离） | `0 ~ 2` | 否 |
| IP（内积距离） | `-无穷 ~ 无穷` | 否 |

#### L2 距离的经验参考值（bge-large + 1024 维）

| distance 范围 | 含义 | 示例 |
|--------------|------|------|
| 0 ~ 0.5 | 非常相似 | 搜"数据库配置"，命中"TypeORM 数据库连接设置" |
| 0.5 ~ 1.0 | 比较相似 | 搜"数据库配置"，命中"后端项目的环境变量" |
| 1.0 ~ 1.5 | 有一定关联 | 搜"数据库配置"，命中"NestJS 模块化架构" |
| > 1.5 | 基本不相关 | 搜"数据库配置"，命中"今天天气很好" |

注意：这只是粗略参考，不同模型、不同内容差异很大。**看相对值（排前面的比排后面的更相关）比看绝对值更靠谱。**

### score（相似度分数）

score 是我们从 distance 转换出来的**展示用分数**，方便直观判断。

**score 不影响搜索精准度和排序。** ChromaDB 内部用 distance 排序，排序在返回之前就完成了。score 只是把 distance 转成"越大越好"的数字给人看。

#### 计算公式

```ts
score = 1 / (1 + distance)
```

| distance | score | 含义 |
|----------|-------|------|
| 0 | 1.0 | 完全相同 |
| 0.5 | 0.67 | 非常相似 |
| 1.0 | 0.5 | 比较相似 |
| 2.0 | 0.33 | 关联度一般 |
| 10.0 | 0.09 | 基本不相关 |

#### 为什么不用 `1 - distance`？

最初的公式是 `score = 1 - distance`，但 L2 距离范围是 `0 ~ 无穷大`，当 distance > 1 时 score 就变成负数了。`1 / (1 + distance)` 保证 score 永远在 `0 ~ 1` 之间。

---

## 实战踩坑记录

### 坑 1：413 Payload Too Large — 文本一次性发太多

**报错**：
```
APIError: 413 status code (no body)
```

**原因**：`embeddings.embedDocuments(chunks)` 把所有文本片段一次性发给硅基流动 API，总量超出了 API 的请求体大小限制。

**解决**：在 `vector-store.util.ts` 的 `storeChunks` 函数中改为分批处理：

```ts
const batchSize = 5; // 每批 5 个片段

for (let i = 0; i < chunks.length; i += batchSize) {
  const batchChunks = chunks.slice(i, i + batchSize);
  const batchVectors = await embeddings.embedDocuments(batchChunks);
  await collection.add({ ... });
}
```

同时把 `text-splitter.util.ts` 的 chunkSize 从 1000 改为 500，减小每个片段的大小。

---

### 坑 2：Swagger 请求 Failed to fetch — 上传大文件超时

**报错**：Swagger UI 显示

```
Failed to fetch.
Possible Reasons: CORS, Network Failure
```

**原因**：大文件的完整处理流程（解析 → 切片 → 向量化）可能需要几十秒到几分钟。Swagger UI 的请求有默认超时，等不了那么久就断开了。

**但后端其实还在跑。** 查看终端日志能看到处理进度。

**解决**：
- 大文件用 curl 测试（curl 默认不超时）
- 小文件可以继续用 Swagger

---

### 坑 3：score 返回负值

**现象**：搜索结果中 `score` 为 `-0.47`。

**原因**：初始公式 `score = 1 - distance`，但 ChromaDB 默认用 L2 距离，范围是 `0 ~ 无穷大`。当 distance > 1 时，score 变成负数。

**解决**：换公式：

```ts
// 改前：L2 距离下会出负值
score: 1 - distance

// 改后：永远在 0~1 之间
score: 1 / (1 + distance)

这个值对搜索结果的精准度没有影响，只是方便人们查看比较。
```

---

### 坑 4：搜索结果 content 是 "-- 1 of 1 --"

**现象**：上传 PDF 后搜索，返回的 content 不是文档内容，而是 `-- 1 of 1 --`。

**原因**：PDF 是扫描件（图片型），没有文本层。`pdf-parse` 只能提取文本层，对纯图片 PDF 只能拿到页码信息。

**验证方法**：用鼠标在 PDF 中尝试选中文字，选不中就是扫描件。

**解决**：扫描件需要 OCR（光学字符识别），当前不支持。换一个有文字内容的文件测试。

---

## 常见报错速查表

| 报错 | 原因 | 解决 |
|------|------|------|
| `413 status code` | 一次发送的文本太多，超出 API 限制 | 分批处理，减小 batchSize 和 chunkSize |
| `Failed to fetch`（Swagger） | 大文件处理超时，Swagger 断开连接 | 用 curl 测试，或换小文件 |
| `Collection not found: kb_xxx` | 该知识库没有上传过文档 | 先上传文件到该知识库 |
| `BadRequestException: 参数必填` | URL 中缺少 q 或 knowledgeBaseId | 检查 query string |
| `Failed to connect to chromadb` | ChromaDB 服务没启动 | `chroma run` |
| 返回结果为空数组 | 知识库中没有相关内容 | 检查知识库 ID，或换搜索词 |
| `Cannot GET /search/query` | 路由没生效 | `@Get('query')` 放在 `@Get(':id')` 前面 |
| score 为负数 | 用了 `1 - distance` 公式 | 改为 `1 / (1 + distance)` |
| content 是 `-- 1 of 1 --` | PDF 是扫描件，没有文本层 | 换有文字内容的文件 |

### 路由顺序注意

NestJS 的路由匹配是从上到下的。如果 `@Get(':id')` 在 `@Get('query')` 前面：

```
GET /search/query
  → 先匹配到 @Get(':id') → id = "query" → 当作 findOne 处理 → 找不到 → 404
```

所以 `@Get('query')` 必须放在 `@Get(':id')` 前面。

---

## 知识图谱（这一步你学到了什么）

```
语义搜索
├── 搜索流程
│   用户输入问题 → Embedding → 向量 → ChromaDB query → Top-K 结果
│
├── 和关键词搜索的区别
│   ├── 关键词：精确匹配文字（SQL LIKE '%xxx%'）
│   └── 语义：匹配含义（向量距离计算）
│
├── 搜索结果的指标
│   ├── distance — L2 距离，0~无穷大，越小越相似（ChromaDB 原始值）
│   ├── score — 1/(1+distance)，0~1，越大越相似（展示用，不影响排序）
│   └── 看相对值比绝对值更靠谱
│
├── NestJS 路由知识
│   ├── @Query() — 从 URL query string 取参数
│   ├── @ApiQuery() — Swagger 显示查询参数
│   └── 路由顺序：具体路径放在 :id 参数前面
│
└── 在 RAG 系统中的位置
    上传 → 解析 → 切片 → 向量化 → [搜索] → 生成回答
                                    ^^^^^^
                                    你在这里
```

---

## 当前进度

```
第一步：文件上传            ✅
第二步：文件解析            ✅
第三步：文本切片            ✅
第四步：向量化 + ChromaDB   ✅
第五步：语义搜索            ← 你在这里
第六步：RAG 对话（下一步）
第七步：流式输出
```

完成这一步后，你的知识库系统已经能**存入文档并搜索到相关内容**了。

下一步（第六步）是最激动人心的：用户提问 → 搜索相关片段 → AI 生成回答。也就是完整的 RAG（检索增强生成）对话。
