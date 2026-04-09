# 第三步：文本切片（Chunking）

## 目标

把解析出来的长文本切成小片段（chunk），为后续向量化做准备。

## 为什么要切片？

```
一篇 10000 字的文档
  │
  ├── 直接整篇向量化？❌
  │   - Embedding 模型有 token 上限（OpenAI 最大 8191 tokens）
  │   - 整篇文档的向量太"模糊"，搜索时匹配不精准
  │
  └── 切成小片段再向量化？✅
      - 每片 500~1000 字，在 token 限制内
      - 向量更精准，搜索时能定位到具体段落
      - 用户提问时，只取最相关的几个片段给 AI，而不是整篇文档
```

### 类比前端

就像前端做虚拟滚动（Virtual Scroll）：
- 不把 10000 条数据全部渲染到 DOM → 不把整篇文档全部丢给 AI
- 只渲染可视区域的几十条 → 只取最相关的几个片段

## 切片策略

### RecursiveCharacterTextSplitter

LangChain 提供的最常用切片器，策略是：

```
优先按大块分隔符切 → 切不动再按小块分隔符切 → 最后按字符数强切

分隔符优先级（从高到低）：
1. "\n\n"  （段落）    ← 优先保持段落完整
2. "\n"    （换行）    ← 其次保持行完整
3. " "     （空格）    ← 再次按单词切
4. ""      （逐字符）  ← 最后手段
```

### 两个关键参数

```
chunkSize: 1000      每个片段最大 1000 个字符
chunkOverlap: 200    相邻片段重叠 200 个字符
```

**为什么要重叠（overlap）？**

```
不重叠的问题：
片段1: "...NestJS 是一个后端框架，它基于"
片段2: "Express，支持 TypeScript..."

→ "NestJS 基于 Express" 这个完整语义被切断了

有重叠：
片段1: "...NestJS 是一个后端框架，它基于 Express，支持"
片段2: "它基于 Express，支持 TypeScript..."
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         重叠部分，保证语义连贯
```

---

## 安装依赖

```bash
cd backend && pnpm add @langchain/textsplitters
```

注意：这是 LangChain v2 拆分出来的独立包，不在 `langchain` 主包里。

---

## 实现步骤

### 第 1 步：新建切片工具

新建文件：`src/common/utils/text-splitter.util.ts`

#### 完整代码

```ts
// src/common/utils/text-splitter.util.ts

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * 将长文本切分成小片段
 *
 * @param text - 待切分的纯文本（来自 parseFile 的输出）
 * @param chunkSize - 每个片段的最大字符数，默认 1000
 * @param chunkOverlap - 相邻片段的重叠字符数，默认 200
 * @returns 切分后的文本片段数组
 */
export async function splitText(
  text: string,
  chunkSize = 1000,
  chunkOverlap = 200,
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    // 分隔符优先级：段落 > 换行 > 空格 > 逐字符
    // 这是默认值，写出来方便你理解
    separators: ['\n\n', '\n', ' ', ''],
  });

  const chunks = await splitter.splitText(text);
  return chunks;
}
```

#### 代码解释

```ts
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
```
- 从 LangChain 的 textsplitters 包中导入切片器
- 这个包你刚才已经安装了

```ts
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize,       // 每片最多 1000 字符
  chunkOverlap,    // 相邻片段重叠 200 字符
  separators: ['\n\n', '\n', ' ', ''],
});
```
- 创建切片器实例
- `separators` 定义了切分优先级：
  - 先尝试按 `\n\n`（段落）切
  - 段落太长就按 `\n`（换行）切
  - 还是太长就按空格切
  - 最后兜底按字符切

```ts
const chunks = await splitter.splitText(text);
```
- `splitText` 接收一个字符串，返回 `string[]`
- 为什么是 async？因为 LangChain 的 API 统一设计为异步的

#### 切片效果示例

输入一篇 3000 字的文档，chunkSize=1000，chunkOverlap=200：

```
原文: [============================] 3000 字

切片后:
chunk 0: [==========]                    ← 0~1000 字
chunk 1:        [==========]             ← 800~1800 字（前 200 字与 chunk0 重叠）
chunk 2:              [==========]       ← 1600~2600 字（前 200 字与 chunk1 重叠）
chunk 3:                    [======]     ← 2400~3000 字（前 200 字与 chunk2 重叠）
```

---

### 第 2 步：修改 Service — 在解析后加入切片

改造 `document.service.ts` 的 `createFromUpload` 方法。

#### 新增的 import

```ts
import { splitText } from '../../common/utils/text-splitter.util';
```

#### 在 try 块中，`status: 'parsed'` 之前加入切片逻辑

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
    const chunks = await splitText(text);

    console.log(`[切片完成] 文件: ${file.originalname}, 共 ${chunks.length} 个片段`);
    // 打印前 3 个片段预览（调试用）
    chunks.slice(0, 3).forEach((chunk, i) => {
      console.log(`  片段${i}: ${chunk.substring(0, 80)}...`);
    });

    // 更新切片数量
    await this.documentParseRepository.update(saved.id, {
      chunkCount: String(chunks.length),
      status: 'parsed',
    });

    // TODO: 第四步在这里继续 — 将 chunks 向量化并存入 ChromaDB

  } catch (error) {
    console.error(`[处理失败] 文件: ${file.originalname}`, error);
    await this.documentParseRepository.update(saved.id, { status: 'failed' });
  }

  return this.documentParseRepository.findOne({ where: { id: saved.id } });
}
```

#### 改动说明

| 改动 | 说明 |
|------|------|
| 新增 `import { splitText }` | 引入切片工具 |
| 新增 `status: 'splitting'` | 状态流转多了一步 |
| 调用 `splitText(text)` | 把解析出来的文本切片 |
| 更新 `chunkCount` | 把切片数量写回数据库 |
| `console.log` 打印前 3 个片段 | 临时调试用，确认切片结果 |

#### 完整状态流转

```
uploaded → parsing → splitting → parsed
                                   ↑
                              后续第四步会加：
                         splitting → embedding → done
```

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `src/common/utils/text-splitter.util.ts` | **新建** — 文本切片工具 |
| `src/modules/document/document.service.ts` | **修改** — createFromUpload 加入切片逻辑 |

---

## 验收测试

### 测试 1：上传一个较长的 TXT/MD 文件

准备一个 2000+ 字的文本文件上传。

期望结果：
- 接口返回 `chunkCount` 大于 1（比如 `"3"` 或 `"4"`）
- 接口返回 `status: "parsed"`
- 终端打印：
  ```
  [解析完成] 文件: xxx.txt, 文本长度: 2500 字符
  [切片完成] 文件: xxx.txt, 共 3 个片段
    片段0: 这是第一段内容...
    片段1: 这是第二段内容...
    片段2: 这是第三段内容...
  ```

### 测试 2：上传一个很短的文件

准备一个只有 100 字的文件上传。

期望结果：
- `chunkCount` 为 `"1"`（不足 1000 字，不需要切）
- 整篇文档就是一个完整的片段

### 测试 3：上传 PDF 文件

验证 PDF 解析 + 切片的完整链路：

- 终端能打印出解析的文本
- 能看到切片数量和片段预览

---

## 常见报错

| 报错 | 原因 | 解决 |
|------|------|------|
| `Cannot find module '@langchain/textsplitters'` | 没安装 | `cd backend && pnpm add @langchain/textsplitters` |
| `chunkCount` 始终为 `"0"` | 切片逻辑没执行到 | 检查 `parseFile` 是否返回了空字符串 |
| 切片数量特别多（几百个） | `chunkSize` 太小 | 检查参数，默认应该是 1000 |
| ESLint 报类型错误 | `splitText` 返回类型推断问题 | 确保函数返回类型标注为 `Promise<string[]>` |

---

## 知识图谱（这一步你学到了什么）

```
文本切片（Chunking）
├── 为什么要切片
│   ├── Embedding 模型有 token 上限
│   ├── 整篇向量太模糊，搜索不精准
│   └── RAG 只需要最相关的几个片段，不需要整篇
│
├── RecursiveCharacterTextSplitter
│   ├── 按分隔符优先级递归切分
│   ├── chunkSize — 每片最大字符数
│   ├── chunkOverlap — 相邻片段重叠字符数（保证语义连贯）
│   └── separators — 切分优先级：段落 > 换行 > 空格 > 字符
│
└── 在 RAG 系统中的位置
    解析文本 → [切片] → 向量化 → 存入向量库 → 检索 → 生成回答
                 ^^^
               你在这里
```

---

## 当前进度

```
第一步：文件上传    ✅
第二步：文件解析    ✅
第三步：文本切片    ← 你在这里
第四步：向量化 + 存入 ChromaDB（下一步）
第五步：串联完整流程
```

写好了告诉我，通过后进入第四步（向量化 + 存入 ChromaDB）— 这是整个系统最核心的一步。
