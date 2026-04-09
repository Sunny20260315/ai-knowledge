# 网页链接解析 - 实现文档

## 功能说明

支持用户输入网页 URL，自动抓取网页内容并解析为知识库文档，后续可用于 RAG 问答。

## 技术选型

| 方案 | 库 | 优缺点 |
|------|---|--------|
| **当前方案** | `cheerio` + `@langchain/community` 的 `CheerioWebBaseLoader` | 轻量、无需浏览器环境、适合静态页面 |
| 备选方案 | `puppeteer` / `playwright` | 支持 JS 渲染的 SPA 页面，但需要安装浏览器，资源占用大 |
| 备选方案 | `mozilla/readability` | 专注于提取文章正文，去除导航/广告等噪音 |

**选择 cheerio 的原因**：项目已有 `@langchain/community` 依赖，CheerioWebBaseLoader 开箱即用，只需额外装 `cheerio`。

## 处理流程

```
用户输入 URL
    ↓
1. CheerioWebBaseLoader 抓取网页 HTML
    ↓
2. cheerio 解析 HTML → 提取纯文本（自动去除 script/style 等标签）
    ↓
3. splitText() 文本切片（与文件上传共用同一个切片逻辑）
    ↓
4. storeChunks() 向量化 + 存入 ChromaDB（与文件上传共用）
    ↓
5. 更新数据库记录状态为 done
```

## 代码结构

### 后端

#### 1. 接口定义 - `document.controller.ts`

```typescript
@Post('url')
createFromUrl(
  @Body('url') url: string,
  @Body('knowledgeBaseId') knowledgeBaseId: string,
) {
  return this.documentService.createFromUrl(url, knowledgeBaseId);
}
```

- 请求方式：`POST /document-parse/url`
- 请求体：`{ url: string, knowledgeBaseId: string }`
- 返回：文档记录对象

#### 2. 核心逻辑 - `document.service.ts`

```typescript
async createFromUrl(url: string, knowledgeBaseId: string) {
  // 1. 创建数据库记录（fileType 标记为 'url'）
  const saved = await this.documentParseRepository.save({
    fileName: '从URL提取的文件名',
    filePath: url,          // filePath 存的是原始 URL
    fileType: 'url',        // 用 'url' 区分文件上传
    knowledgeBaseId,
    status: 'uploaded',
  });

  // 2. 用 CheerioWebBaseLoader 抓取网页
  const loader = new CheerioWebBaseLoader(url);
  const docs = await loader.load();
  const text = docs.map(d => d.pageContent).join('\n');

  // 3. 切片（复用已有逻辑）
  const chunks = await splitText(text);

  // 4. 向量化存入 ChromaDB（复用已有逻辑）
  await storeChunks(chunks, knowledgeBaseId, saved.id, fileName);

  // 5. 更新状态
  await this.documentParseRepository.update(saved.id, {
    chunkCount: String(chunks.length),
    status: 'done',
  });
}
```

#### 3. CheerioWebBaseLoader 原理

```
CheerioWebBaseLoader 内部流程：
1. 用 fetch/axios 发 GET 请求获取 HTML
2. 用 cheerio（服务端 jQuery）解析 DOM
3. 提取 <body> 内的文本内容
4. 自动过滤 <script>、<style>、<noscript> 等标签
5. 返回 Document[] 数组（langchain 格式）
```

### 前端

#### API 调用 - `api.ts`

```typescript
export async function parseUrl(url: string, knowledgeBaseId: string) {
  const res = await fetch(`${API_BASE}/document-parse/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, knowledgeBaseId }),
  });
  return res.json();
}
```

#### UI - `knowledge/[id]/page.tsx`

在文档管理卡片内，上传区域下方增加 URL 输入框 + 解析按钮。

## 数据库存储

URL 解析的文档与文件上传的文档共用同一张 `document_parse` 表：

| 字段 | 文件上传 | URL 解析 |
|------|---------|---------|
| fileName | 原始文件名 | URL 路径末段 |
| filePath | 本地临时路径 | 原始 URL |
| fileType | pdf/docx/md/txt | url |
| fileSize | 文件字节数 | 0 |

## 局限性与改进方向

### 当前局限

1. **不支持 SPA 页面**：cheerio 只能解析静态 HTML，无法执行 JavaScript。React/Vue 等 SPA 页面会抓到空内容
2. **不支持登录页面**：无法处理需要认证的页面
3. **噪音较多**：会把导航栏、页脚等非正文内容也一起提取

### 改进方向

1. **使用 Readability 提取正文**：
   ```typescript
   // 安装 @mozilla/readability 和 jsdom
   import { Readability } from '@mozilla/readability';
   import { JSDOM } from 'jsdom';

   const dom = new JSDOM(html, { url });
   const article = new Readability(dom.window.document).parse();
   const text = article.textContent; // 干净的正文
   ```

2. **使用 Puppeteer 支持 SPA**：
   ```typescript
   import puppeteer from 'puppeteer';

   const browser = await puppeteer.launch();
   const page = await browser.newPage();
   await page.goto(url, { waitUntil: 'networkidle0' });
   const text = await page.evaluate(() => document.body.innerText);
   await browser.close();
   ```

3. **批量 URL 导入**：支持一次粘贴多个 URL，或导入 sitemap.xml

4. **定时重新抓取**：网页内容会更新，可以加定时任务重新抓取并更新向量库
