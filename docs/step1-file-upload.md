# 第一步：实现文件上传接口

## 目标

新增一个接口 `POST /document-parse/upload`，用户上传文件（PDF/Word/MD/TXT），服务端保存到本地目录，并在数据库中创建一条记录。

## 最终效果

在 Swagger（`http://localhost:3000/api`）上传一个文件后：
1. 文件被保存到 `src/storage/temp/` 目录
2. 数据库 `document_parse` 表新增一条记录（文件名、类型、大小、状态为 `uploaded`）
3. 接口返回这条记录的完整信息

---

## 前置知识

### NestJS 文件上传的工作原理

```
客户端发送 multipart/form-data
       │
       ▼
Multer 中间件拦截请求，把文件从请求流中提取出来
       │
       ▼
FileInterceptor 装饰器告诉 NestJS：用 Multer 处理 "file" 字段
       │
       ▼
@UploadedFile() 装饰器注入解析后的文件对象（包含文件名、大小、路径等信息）
       │
       ▼
你的 Controller 方法拿到文件对象，做业务处理
```

### 文件对象 `Express.Multer.File` 的结构

上传完成后，你在 Controller 中拿到的 `file` 对象长这样：

```ts
{
  fieldname: 'file',           // 表单字段名
  originalname: 'readme.pdf',  // 原始文件名
  encoding: '7bit',
  mimetype: 'application/pdf', // MIME 类型
  destination: './src/storage/temp',  // 保存目录
  filename: '1711929600000-readme.pdf', // 保存后的文件名
  path: './src/storage/temp/1711929600000-readme.pdf', // 完整路径
  size: 102400                 // 文件大小（字节）
}
```

---

## 实现步骤

### 第 1 步：确保存储目录存在

检查 `backend/src/storage/temp/` 目录是否存在，不存在就手动创建：

```bash
mkdir -p src/storage/temp
```

### 第 2 步：创建 Multer 配置文件

新建文件 `src/common/config/multer.config.ts`。

这个文件负责告诉 Multer：
- **文件存到哪** → `diskStorage` 的 `destination`
- **文件叫什么名** → `diskStorage` 的 `filename`（加时间戳防重名）
- **什么文件能传** → `fileFilter`（只允许 pdf/docx/md/txt）
- **文件多大为上限** → `limits.fileSize`

需要用到的 API：

```ts
import { diskStorage } from 'multer';
import { extname } from 'path';
```

你需要导出一个对象，包含三个属性：

```ts
export const multerConfig = {
  storage: diskStorage({
    destination: ???,   // 保存目录，用 .env 的 TEMP_FILE_PATH
    filename: ???,      // 自定义文件名：时间戳 + 原始文件名
  }),
  fileFilter: ???,      // 校验函数：检查文件扩展名是否合法
  limits: {
    fileSize: ???,      // 最大文件大小，50MB = 50 * 1024 * 1024
  },
};
```

**关键点**：

- `destination` 是一个函数 `(req, file, cb) => cb(null, '目标目录路径')`
- `filename` 是一个函数 `(req, file, cb) => cb(null, '新文件名')`
- `fileFilter` 是一个函数 `(req, file, cb) => cb(null, true/false)`
- 用 `extname(file.originalname)` 获取扩展名（如 `.pdf`）
- 允许的扩展名：`.pdf`, `.docx`, `.md`, `.txt`

### 第 3 步：修改 Controller — 新增 upload 方法

在 `document.controller.ts` 中新增一个 `upload` 方法。

需要新增的 import：

```ts
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { multerConfig } from '../../common/config/multer.config';
```

方法签名参考：

```ts
@Post('upload')
@ApiOperation({ summary: '上传文档' })
@ApiConsumes('multipart/form-data')    // 告诉 Swagger 这是文件上传
@ApiBody({                              // 告诉 Swagger 请求体的结构
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
      knowledgeBaseId: { type: 'string' },
    },
  },
})
@UseInterceptors(FileInterceptor('file', multerConfig))  // 用 Multer 处理
upload(
  @UploadedFile() file: Express.Multer.File,   // 注入文件对象
  @Body('knowledgeBaseId') knowledgeBaseId: string,  // 注入表单字段
) {
  // 在这里调用 service 保存记录到数据库
}
```

**解释每个装饰器的作用**：

| 装饰器 | 作用 |
|--------|------|
| `@ApiConsumes('multipart/form-data')` | 告诉 Swagger 这个接口接收文件，不是 JSON |
| `@ApiBody({ schema: ... })` | 在 Swagger UI 上显示文件上传表单 |
| `@UseInterceptors(FileInterceptor('file', multerConfig))` | 用 Multer 拦截请求，处理名为 `file` 的字段 |
| `@UploadedFile()` | 把 Multer 解析好的文件对象注入到参数中 |
| `@Body('knowledgeBaseId')` | 从 multipart 表单中提取 knowledgeBaseId 字段 |

**方法体的逻辑**：

1. 检查 `file` 是否存在（不存在说明没上传或被 fileFilter 拒绝）
2. 调用 `this.documentService.createFromUpload(file, knowledgeBaseId)`
3. 返回保存后的记录

### 第 4 步：修改 Service — 新增 createFromUpload 方法

在 `document.service.ts` 中新增方法：

```ts
async createFromUpload(file: Express.Multer.File, knowledgeBaseId: string) {
  // 1. 用 file 对象的信息创建 entity
  //    - fileName: file.originalname
  //    - fileType: 从 originalname 中提取扩展名（去掉点号）
  //    - fileSize: file.size 转字符串
  //    - knowledgeBaseId: 参数传入
  //    - chunkCount: '0'（还没切片，先填 0）
  //    - status: 'uploaded'（第一个状态）
  //
  // 2. 保存到数据库
  // 3. 返回保存后的记录
}
```

### 第 5 步：给 Entity 添加 filePath 字段

当前的 `document.entity.ts` 缺少文件路径字段。后续解析文件时需要知道文件存在哪里。

在 `DocumentParse` entity 中新增：

```ts
@Column({ type: 'text', nullable: true })
filePath: string;
```

同时数据库用了 `synchronize: true`，TypeORM 会自动加这个列。

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `src/common/config/multer.config.ts` | **新建** — Multer 配置 |
| `src/modules/document/document.controller.ts` | **修改** — 新增 upload 方法 |
| `src/modules/document/document.service.ts` | **修改** — 新增 createFromUpload 方法 |
| `src/modules/document/entities/document.entity.ts` | **修改** — 新增 filePath 字段 |

---

## 验收测试

### 方法 1：用 Swagger

1. 打开 `http://localhost:3000/api`
2. 找到 `POST /document-parse/upload`
3. 点击 "Try it out"
4. 选择一个 PDF 文件，填入 knowledgeBaseId
5. 点击 Execute

期望结果：
```json
{
  "id": "xxx-xxx-xxx",
  "fileName": "readme.pdf",
  "fileType": "pdf",
  "fileSize": "102400",
  "filePath": "./src/storage/temp/1711929600000-readme.pdf",
  "knowledgeBaseId": "kb-xxx",
  "chunkCount": "0",
  "status": "uploaded",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 方法 2：用 curl

```bash
curl -X POST http://localhost:3000/document-parse/upload \
  -F "file=@./test.pdf" \
  -F "knowledgeBaseId=kb-001"
```

### 检查点

- [ ] `src/storage/temp/` 下能看到上传的文件
- [ ] 数据库 `document_parse` 表有新记录
- [ ] 上传 `.exe` 文件会被拒绝
- [ ] 上传超过 50MB 的文件会被拒绝

---

## 常见报错预判

| 报错 | 原因 | 解决 |
|------|------|------|
| `Cannot read properties of undefined (reading 'filename')` | `file` 为 undefined，说明 FileInterceptor 没匹配到字段 | 检查前端/curl 的字段名是否叫 `file` |
| `ENOENT: no such file or directory` | 存储目录不存在 | 手动 `mkdir -p src/storage/temp` 或在配置中自动创建 |
| `File too large` | 文件超过 limits 设置的大小 | 正常拦截，可以用 ExceptionFilter 返回友好提示 |
| `whitelist 过滤掉 knowledgeBaseId` | `@Body('knowledgeBaseId')` 直接取单个字段，不走 DTO 校验，不会被 whitelist 影响 | 无需处理 |

---

## 知识图谱（这一步你学到了什么）

```
NestJS 文件上传
├── Multer 中间件 — Node.js 处理 multipart/form-data 的标准库
│   ├── diskStorage — 存到磁盘
│   ├── memoryStorage — 存到内存（Buffer）
│   ├── fileFilter — 过滤不合法文件
│   └── limits — 大小限制
├── @UseInterceptors + FileInterceptor — NestJS 对 Multer 的封装
├── @UploadedFile() — 从请求中提取文件对象
└── @ApiConsumes + @ApiBody — Swagger 文件上传文档
```

写好了告诉我，我帮你看代码，然后进入第二步（文件解析）。
