# 第二步：文件解析（提取纯文本）

## 目标

读取上传的文件，根据文件类型调用不同解析器，提取出纯文本内容，为后续切片和向量化做准备。

## 整体流程

```
上传的文件（存在 storage/temp/ 下）
  │
  ├── .pdf  → pdf-parse 解析        → 纯文本
  ├── .docx → mammoth 解析          → 纯文本
  ├── .md   → fs 直接读取            → 纯文本
  └── .txt  → fs 直接读取            → 纯文本
         │
         ▼
   返回 string（整篇文档的文本内容）
```

---

## 前置知识

### 为什么不同格式要用不同解析器？

| 格式 | 文件本质 | 为什么不能直接 readFile |
|------|---------|----------------------|
| `.txt` | 纯文本 | 可以直接读 |
| `.md` | 纯文本（带标记符号） | 可以直接读，标记符号不影响语义 |
| `.pdf` | 二进制格式，内含字体、布局、图片等 | readFile 只会得到乱码 |
| `.docx` | 本质是 ZIP 压缩包，内含 XML 文件 | readFile 只会得到乱码 |

### 四个解析器

| 文件类型 | 用到的包 | 作用 |
|---------|---------|------|
| PDF | `pdf-parse` | 从 PDF 二进制中提取文本层 |
| Word | `mammoth` | 从 docx 的 XML 结构中提取纯文本 |
| Markdown | `fs`（Node.js 内置） | 直接读取，不需要第三方包 |
| TXT | `fs`（Node.js 内置） | 直接读取 |

这四个包你的 `package.json` 中都已安装，不需要再装。

---

## 实现步骤

### 第 1 步：新建文件解析工具

新建文件：`src/common/utils/file-parser.util.ts`

（你的项目里已有这个文件但是空的，直接写入即可）

#### 需要的 import

```ts
import * as fs from 'fs';
```

`pdf-parse` 和 `mammoth` 可能遇到 ESM/CJS 兼容问题，推荐用 `require` 的方式引入（见下方完整代码）。

#### 核心函数签名

```ts
export async function parseFile(filePath: string, fileType: string): Promise<string>
```

- 输入：文件路径 + 文件类型（扩展名）
- 输出：Promise<string>，解析后的纯文本
- 为什么是 async？因为 pdf-parse 和 mammoth 都返回 Promise

#### 完整代码

```ts
// src/common/utils/file-parser.util.ts

import * as fs from 'fs';

/**
 * 根据文件类型解析文件，提取纯文本内容
 * @param filePath 文件路径（Multer 保存后的路径）
 * @param fileType 文件扩展名（pdf / docx / md / txt）
 * @returns 解析后的纯文本
 */
export async function parseFile(
  filePath: string,
  fileType: string,
): Promise<string> {
  switch (fileType) {
    case 'pdf':
      return parsePdf(filePath);

    case 'docx':
      return parseDocx(filePath);

    case 'md':
    case 'txt':
      return parseText(filePath);

    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

/**
 * 解析 PDF 文件
 *
 * 原理：PDF 是二进制格式，内部用特殊编码存储文本、字体、布局。
 * pdf-parse 库会遍历 PDF 内部结构，把所有文本层的内容提取出来拼成字符串。
 *
 * 注意：扫描件 PDF（图片型）无法提取文本，因为没有文本层。
 */
async function parsePdf(filePath: string): Promise<string> {
  // 用 require 引入，避免 ESM/CJS 兼容问题
  const pdf = require('pdf-parse');

  // 1. 读取文件为 Buffer（二进制数据）
  const buffer = fs.readFileSync(filePath);

  // 2. pdf-parse 接收 Buffer，返回解析结果
  const data = await pdf(buffer);

  // data 的结构：
  // {
  //   numpages: 10,          // 页数
  //   numrender: 10,         // 渲染页数
  //   info: { ... },         // PDF 元信息（标题、作者等）
  //   metadata: { ... },     // 元数据
  //   text: '...'            // ← 我们要的纯文本，所有页的文本拼在一起
  //   version: '1.10.100'
  // }

  return data.text;
}

/**
 * 解析 Word (.docx) 文件
 *
 * 原理：.docx 文件本质上是一个 ZIP 压缩包，解压后里面是一堆 XML 文件。
 * 主要内容在 word/document.xml 中。
 * mammoth 会解析这些 XML，提取出纯文本内容。
 *
 * 注意：不支持 .doc（旧版 Word 格式），只支持 .docx
 */
async function parseDocx(filePath: string): Promise<string> {
  const mammoth = require('mammoth');

  // mammoth.extractRawText 直接提取纯文本（不含格式）
  // 还有 mammoth.convertToHtml 可以转 HTML（我们不需要）
  const result = await mammoth.extractRawText({ path: filePath });

  // result 的结构：
  // {
  //   value: '...',           // ← 纯文本内容
  //   messages: [ ... ]       // 解析过程中的警告信息
  // }

  return result.value;
}

/**
 * 解析纯文本文件（TXT / Markdown）
 *
 * Markdown 虽然有 #、**、- 等标记符号，但这些不影响语义理解，
 * AI 模型能直接理解 Markdown 语法，所以不需要额外转换。
 */
function parseText(filePath: string): string {
  // utf-8 是最常见的文本编码，中英文都支持
  return fs.readFileSync(filePath, 'utf-8');
}
```

#### 为什么用 require 而不是 import？

```ts
// ❌ 可能报错：ESM/CJS 兼容问题
import pdf from 'pdf-parse';

// ✅ 稳妥写法
const pdf = require('pdf-parse');
```

NestJS 项目默认编译成 CommonJS 模块，但有些第三方包的导出格式不一致。
`require` 是 CommonJS 原生语法，兼容性最好。
等你熟悉了 ESM/CJS 的区别后，可以再改回 import。

如果 ESLint 报 `@typescript-eslint/no-var-requires` 警告，可以在 require 上方加一行注释临时关闭：

```ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');
```

---

### 第 2 步：修改 Service — 在上传流程中加入解析

改造 `document.service.ts` 的 `createFromUpload` 方法。

#### 改造前（你现在的代码）

```ts
createFromUpload(file: Express.Multer.File, knowledgeBaseId: string) {
  const ext = file.originalname.split('.').pop();
  const documentParse = this.documentParseRepository.create({
    fileName: file.originalname,
    filePath: file.path,
    fileType: ext,
    fileSize: String(file.size),
    knowledgeBaseId,
    chunkCount: '0',
    status: 'uploaded',
  });
  return this.documentParseRepository.save(documentParse);
}
```

#### 改造后

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

  // ========== 阶段2：解析文件提取文本 ==========
  try {
    // 更新状态为「解析中」
    await this.documentParseRepository.update(saved.id, { status: 'parsing' });

    // 调用解析工具
    const text = await parseFile(file.path, ext);

    // 打印到控制台，确认解析成功（调试用，后续可删）
    console.log(`[解析完成] 文件: ${file.originalname}`);
    console.log(`[解析完成] 文本长度: ${text.length} 字符`);
    console.log(`[解析完成] 前 200 字: ${text.substring(0, 200)}`);

    // 更新状态为「已解析」
    // 后续第三步（切片）和第四步（向量化）会继续在这里往下写
    await this.documentParseRepository.update(saved.id, { status: 'parsed' });

  } catch (error) {
    // 解析失败，更新状态为 failed，记录错误信息
    console.error(`[解析失败] 文件: ${file.originalname}`, error);
    await this.documentParseRepository.update(saved.id, { status: 'failed' });
  }

  // 返回最新的记录
  return this.documentParseRepository.findOne({ where: { id: saved.id } });
}
```

#### 新增的 import（Service 文件顶部）

```ts
import { parseFile } from '../../common/utils/file-parser.util';
```

#### 关键变化说明

| 变化 | 为什么 |
|------|--------|
| 方法加了 `async` | 因为 `parseFile` 返回 Promise，需要 `await` |
| 加了 `try/catch` | 解析可能失败（比如 PDF 损坏），要优雅处理而不是直接崩溃 |
| 状态流转 `uploaded → parsing → parsed / failed` | 前端可以根据状态显示进度 |
| `console.log` 打印文本 | 临时调试用，确认解析结果正确，后续会删掉 |

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `src/common/utils/file-parser.util.ts` | **新建/重写** — 文件解析工具 |
| `src/modules/document/document.service.ts` | **修改** — createFromUpload 加入解析逻辑 |

---

## 验收测试

### 测试 1：上传 TXT 文件

准备一个内容为 "Hello World 你好世界" 的 `test.txt`，上传后：

- 接口返回 `status: "parsed"`
- 终端打印 `文本长度: 18 字符`

### 测试 2：上传 PDF 文件

上传一个有文字内容的 PDF，上传后：

- 接口返回 `status: "parsed"`
- 终端打印出 PDF 中的文字内容（前 200 字）

### 测试 3：上传 Markdown 文件

上传一个 `.md` 文件，终端应该打印出原始 Markdown 内容（带 #、** 等标记）。

### 测试 4：错误处理

上传一个损坏的 PDF（比如把 .txt 改名为 .pdf），应该：

- 接口返回 `status: "failed"`
- 终端打印错误信息
- 服务不崩溃

---

## 常见报错

| 报错 | 原因 | 解决 |
|------|------|------|
| `Cannot find module 'pdf-parse'` | 包没装或 pnpm 隔离 | `cd backend && pnpm add pdf-parse` |
| `pdf-parse is not a function` | import 方式不对 | 用 `const pdf = require('pdf-parse')` |
| `mammoth.extractRawText is not a function` | 同上 | 用 `const mammoth = require('mammoth')` |
| `ENOENT: no such file or directory` | filePath 路径不对 | `console.log(filePath)` 检查路径 |
| ESLint `no-var-requires` 警告 | ESLint 不允许 require | 在 require 上方加 `// eslint-disable-next-line @typescript-eslint/no-var-requires` |
| 解析出来是空字符串 | PDF 是扫描件（图片型） | 这种 PDF 没有文本层，需要 OCR，暂不处理 |

---

## 知识图谱（这一步你学到了什么）

```
文件解析
├── 文件格式的本质
│   ├── TXT/MD → 纯文本，直接读
│   ├── PDF → 二进制格式，需要专门的解析器
│   └── DOCX → ZIP 压缩的 XML，需要专门的解析器
│
├── Node.js 文件读取
│   ├── fs.readFileSync(path, 'utf-8') → 读成字符串
│   └── fs.readFileSync(path) → 读成 Buffer（二进制）
│
├── 第三方解析库
│   ├── pdf-parse → PDF 文本提取
│   └── mammoth → Word 文本提取
│
└── ESM vs CJS 兼容性
    ├── import xxx from 'xxx' → ESM 语法
    ├── const xxx = require('xxx') → CJS 语法
    └── NestJS 默认编译成 CJS，第三方包可能有兼容问题
```

---

## 当前进度

```
第一步：文件上传 ✅
第二步：文件解析 ← 你在这里
第三步：文本切片（下一步）
第四步：向量化 + 存入 ChromaDB
第五步：串联完整流程
```

写好了告诉我，我帮你看代码。通过后进入第三步（文本切片）。
