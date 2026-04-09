# 第八步：前端页面

## 目标

构建 Web 界面，让用户可以通过浏览器使用知识库系统：管理知识库、上传文档、进行 AI 对话。

## 技术选型

| 技术 | 用途 | 为什么选它 |
|------|------|-----------|
| **Next.js** | React 框架 | 项目脚手架完善，开箱即用，社区生态好 |
| **TailwindCSS** | 样式 | 不用写 CSS 文件，直接在 HTML 里写 class，快 |
| **TypeScript** | 类型安全 | 和后端保持一致，接口对接时有类型提示 |

### 什么是 Next.js？

```
React：一个 UI 库，只负责"怎么渲染组件"
  → 路由、打包、SSR 都要自己配

Next.js：基于 React 的框架，帮你把这些都配好了
  → 文件系统路由（创建文件 = 创建页面）
  → 内置打包工具
  → 开箱即用的开发服务器
  → 类比：React 是发动机，Next.js 是整辆车
```

### 什么是 TailwindCSS？

```
传统 CSS 写法：
  <div class="chat-message">你好</div>

  .chat-message {
    padding: 16px;
    background-color: #f3f4f6;
    border-radius: 8px;
    margin-bottom: 8px;
  }

TailwindCSS 写法（直接写在 class 里）：
  <div class="p-4 bg-gray-100 rounded-lg mb-2">你好</div>

  不需要写 CSS 文件，不需要想 class 名字
  每个 class 对应一个 CSS 属性：
    p-4       → padding: 16px
    bg-gray-100 → background-color: #f3f4f6
    rounded-lg → border-radius: 8px
    mb-2      → margin-bottom: 8px
```

---

## 页面规划

```
整体布局：

┌──────────────────────────────────────────────────────────────┐
│  🧠 AI 知识库助手                                    [设置]    │  ← 顶部导航
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│  📁 知识库列表   │           主内容区                           │
│  ┌────────────┐│                                             │
│  │ 📄 简历知识库 ││   根据左侧选择显示不同内容：                  │
│  │ 📄 技术文档  ││   - 对话页面（默认）                         │
│  │ + 新建知识库 ││   - 知识库详情 + 文档管理                    │
│  └────────────┘│                                             │
│                │                                             │
│  💬 对话列表    │                                             │
│  ┌────────────┐│                                             │
│  │ NestJS怎么..││                                             │
│  │ 文档讲了什..││                                             │
│  │ + 新建对话  ││                                             │
│  └────────────┘│                                             │
│                │                                             │
├────────────────┴─────────────────────────────────────────────┤
```

### 核心页面

| 页面 | 路由 | 功能 |
|------|------|------|
| 对话页 | `/` | AI 对话窗口，流式显示回答，引用来源 |
| 知识库管理 | `/knowledge` | 知识库列表、创建、删除 |
| 知识库详情 | `/knowledge/[id]` | 文档列表、上传文件、删除文档 |

---

## 实现步骤

### 第 1 步：创建 Next.js 项目

在项目根目录执行：

```bash
cd /Users/yujing/Desktop/2026-web3/ai-knowledge
npx create-next-app@latest frontend
```

创建时的选项按照如下选择：

```
✔ Would you like to use TypeScript? → Yes
✔ Would you like to use ESLint? → Yes
✔ Would you like to use Tailwind CSS? → Yes
✔ Would you like your code inside a `src/` directory? → Yes
✔ Would you like to use App Router? (recommended) → Yes
✔ Would you like to use Turbopack for next dev? → Yes
✔ Would you like to customize the import alias? → No（使用默认 @/）
```

#### 选项解释

| 选项 | 选择 | 为什么 |
|------|------|--------|
| TypeScript | Yes | 类型安全，和后端一致 |
| ESLint | Yes | 代码规范检查 |
| Tailwind CSS | Yes | 快速写样式 |
| `src/` 目录 | Yes | 代码和配置分离，结构更清晰 |
| App Router | Yes | Next.js 推荐的新路由方案 |
| Turbopack | Yes | 更快的开发服务器 |
| import alias | No | 默认的 `@/` 已经够用 |

#### 加入 pnpm workspace

创建完后，修改根目录的 `pnpm-workspace.yaml`：

```yaml
packages:
  - "backend"
  - "frontend"
```

然后安装依赖：

```bash
cd frontend
pnpm install
```

### 第 2 步：项目结构规划

```
frontend/src/
├── app/                          # 页面（App Router）
│   ├── layout.tsx                # 全局布局（左侧栏 + 右侧内容）
│   ├── page.tsx                  # 首页 = 对话页
│   └── knowledge/
│       ├── page.tsx              # 知识库列表
│       └── [id]/
│           └── page.tsx          # 知识库详情（文档管理）
│
├── components/                   # 可复用组件
│   ├── Sidebar.tsx               # 左侧栏（知识库列表 + 对话列表）
│   ├── ChatWindow.tsx            # 对话窗口（消息列表 + 输入框）
│   ├── MessageBubble.tsx         # 单条消息气泡
│   ├── FileUpload.tsx            # 文件上传组件
│   └── KnowledgeBaseCard.tsx     # 知识库卡片
│
├── lib/                          # 工具函数
│   └── api.ts                    # 后端 API 调用封装
│
└── types/                        # TypeScript 类型定义
    └── index.ts                  # 接口返回数据的类型
```

#### Next.js App Router 路由规则

```
文件路径                          →  URL 路由
app/page.tsx                     →  /
app/knowledge/page.tsx           →  /knowledge
app/knowledge/[id]/page.tsx      →  /knowledge/abc-123（动态路由）

规则很简单：
  - 每个文件夹下的 page.tsx = 一个页面
  - [id] 文件夹 = 动态参数，URL 中的值会传给组件
  - layout.tsx = 该层级及子页面共享的布局
```

---

### 第 3 步：封装 API 调用 — `lib/api.ts`

把所有后端接口调用封装到一个文件里，组件中直接调用这些函数，不用每次写 fetch。

```ts
const API_BASE = 'http://localhost:3000';

// ==================== 知识库 ====================

/** 获取知识库列表 */
export async function getKnowledgeBases() {
  const res = await fetch(`${API_BASE}/knowledge-base`);
  return res.json();
}

/** 创建知识库 */
export async function createKnowledgeBase(data: { name: string; description?: string }) {
  const res = await fetch(`${API_BASE}/knowledge-base`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 删除知识库 */
export async function deleteKnowledgeBase(id: string) {
  const res = await fetch(`${API_BASE}/knowledge-base/${id}`, { method: 'DELETE' });
  return res.json();
}

// ==================== 文档 ====================

/** 上传文档 */
export async function uploadDocument(file: File, knowledgeBaseId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('knowledgeBaseId', knowledgeBaseId);

  const res = await fetch(`${API_BASE}/document-parse/upload`, {
    method: 'POST',
    body: formData,  // 注意：FormData 不要设置 Content-Type，浏览器会自动加 boundary
  });
  return res.json();
}

/** 获取文档列表 */
export async function getDocuments() {
  const res = await fetch(`${API_BASE}/document-parse`);
  return res.json();
}

/** 删除文档 */
export async function deleteDocument(id: string) {
  const res = await fetch(`${API_BASE}/document-parse/${id}`, { method: 'DELETE' });
  return res.json();
}

// ==================== 对话 ====================

/** 获取会话列表 */
export async function getChatSessions() {
  const res = await fetch(`${API_BASE}/chat`);
  return res.json();
}

/** 获取会话消息 */
export async function getChatMessages(sessionId: string) {
  const res = await fetch(`${API_BASE}/chat/${sessionId}/messages`);
  return res.json();
}

/** 删除会话 */
export async function deleteChatSession(id: string) {
  const res = await fetch(`${API_BASE}/chat/${id}`, { method: 'DELETE' });
  return res.json();
}

/**
 * 发送消息（SSE 流式）
 * 返回 ReadableStream reader，调用方逐块读取
 */
export async function sendMessage(
  content: string,
  knowledgeBaseId?: string,
  sessionId?: string,
) {
  const res = await fetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, knowledgeBaseId, sessionId }),
  });

  return res.body!.getReader();
}

// ==================== 搜索 ====================

/** 语义搜索 */
export async function semanticSearch(q: string, knowledgeBaseId: string, topK = 5) {
  const res = await fetch(
    `${API_BASE}/search/query?q=${encodeURIComponent(q)}&knowledgeBaseId=${knowledgeBaseId}&topK=${topK}`,
  );
  return res.json();
}
```

#### 关键点

```ts
// FormData 上传文件时，不要手动设置 Content-Type
const formData = new FormData();
formData.append('file', file);

fetch(url, {
  method: 'POST',
  // ❌ headers: { 'Content-Type': 'multipart/form-data' }  // 不要加这行！
  body: formData,  // 浏览器会自动设置 Content-Type 并加上 boundary 分隔符
});
```

```ts
// SSE 流式读取，返回 reader 而不是 JSON
export async function sendMessage(...) {
  const res = await fetch(...);
  return res.body!.getReader();  // 返回 ReadableStream 的 reader
}
// 调用方用 while 循环逐块读取（第六步文档中有详细说明）
```

---

### 第 4 步：全局布局 — `app/layout.tsx`

左右分栏布局：左侧栏（知识库 + 对话列表），右侧是页面内容。

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="flex h-screen bg-gray-50">
        {/* 左侧栏 */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 font-bold text-lg border-b">🧠 AI 知识库</div>
          <Sidebar />
        </aside>

        {/* 右侧内容区 */}
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
```

#### TailwindCSS class 解释

```
flex h-screen        → display:flex; height:100vh（占满整个屏幕高度）
w-64                 → width: 16rem（256px，左侧栏宽度）
bg-white             → background: white
border-r             → border-right: 1px solid
border-gray-200      → border-color: #e5e7eb（浅灰色边框）
flex flex-col        → flex-direction: column（子元素垂直排列）
flex-1               → flex: 1（占满剩余空间）
p-4                  → padding: 16px
font-bold            → font-weight: bold
text-lg              → font-size: 18px
```

---

### 第 5 步：左侧栏组件 — `components/Sidebar.tsx`

显示知识库列表和对话列表。

```tsx
'use client';  // 这个组件需要用户交互（点击、状态），标记为客户端组件

import { useEffect, useState } from 'react';
import { getChatSessions, getKnowledgeBases } from '@/lib/api';

export default function Sidebar() {
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    getKnowledgeBases().then(setKnowledgeBases);
    getChatSessions().then(setSessions);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 知识库列表 */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">知识库</h3>
        {knowledgeBases.map((kb: any) => (
          <a
            key={kb.id}
            href={`/knowledge/${kb.id}`}
            className="block p-2 rounded hover:bg-gray-100 text-sm truncate"
          >
            📁 {kb.name}
          </a>
        ))}
        <a href="/knowledge" className="block p-2 text-blue-500 text-sm">
          + 管理知识库
        </a>
      </div>

      {/* 对话列表 */}
      <div className="p-3 border-t">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">对话</h3>
        {sessions.map((s: any) => (
          <div
            key={s.id}
            className="p-2 rounded hover:bg-gray-100 text-sm truncate cursor-pointer"
          >
            💬 {s.title}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### `'use client'` 是什么？

```
Next.js App Router 中，组件默认是"服务端组件"（在服务器上渲染）。
如果组件需要：
  - useState / useEffect（状态和副作用）
  - onClick / onChange（用户事件）
  - 浏览器 API（window、localStorage）

就必须在文件第一行加 'use client'，标记为"客户端组件"（在浏览器中运行）。

我们的 Sidebar 需要 useState 来管理列表数据，所以要加。
```

---

### 第 6 步：对话页面 — `app/page.tsx`

这是核心页面，实现 AI 对话 + SSE 流式显示。

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { sendMessage, getChatSessions, getChatMessages } from '@/lib/api';

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // 先添加一个空的 AI 消息占位
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const reader = await sendMessage(input, knowledgeBaseId || undefined, sessionId || undefined);
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const events = text.split('\n\n').filter(Boolean);

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          const data = JSON.parse(event.replace('data: ', ''));

          if (data.type === 'chunk') {
            // 逐字追加到最后一条 AI 消息
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              last.content += data.data;
              return [...updated];
            });
          } else if (data.type === 'done') {
            setSessionId(data.sessionId);
          } else if (data.type === 'error') {
            console.error('AI 错误:', data.data);
          }
        }
      }
    } catch (error) {
      console.error('请求失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-2xl mb-2">🧠</p>
            <p>选择一个知识库，开始提问</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="输入你的问题..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '思考中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### SSE 流式消费的核心逻辑

```ts
// 1. 先在页面上加一条空的 AI 消息
setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

// 2. 每收到一个 chunk，追加到这条消息的 content 里
if (data.type === 'chunk') {
  setMessages(prev => {
    const updated = [...prev];
    const last = updated[updated.length - 1];  // 最后一条就是 AI 消息
    last.content += data.data;                   // 追加文字
    return [...updated];                         // 触发重新渲染
  });
}

// 效果：页面上的 AI 消息像打字机一样逐字出现
```

---

### 第 7 步：知识库管理页 — `app/knowledge/page.tsx`

列表 + 创建 + 删除。

```tsx
'use client';

import { useState, useEffect } from 'react';
import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase } from '@/lib/api';

export default function KnowledgePage() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadList = () => getKnowledgeBases().then(setList);

  useEffect(() => { loadList(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createKnowledgeBase({ name, description });
    setName('');
    setDescription('');
    loadList();  // 刷新列表
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await deleteKnowledgeBase(id);
    loadList();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">知识库管理</h1>

      {/* 创建表单 */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h2 className="font-semibold mb-3">新建知识库</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="知识库名称（英文，如 resume）"
          className="w-full border rounded px-3 py-2 mb-2"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述（可选）"
          className="w-full border rounded px-3 py-2 mb-3"
        />
        <button
          onClick={handleCreate}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          创建
        </button>
      </div>

      {/* 知识库列表 */}
      <div className="space-y-3">
        {list.map((kb: any) => (
          <div key={kb.id} className="bg-white rounded-lg border p-4 flex justify-between items-center">
            <div>
              <a href={`/knowledge/${kb.id}`} className="font-semibold text-blue-600 hover:underline">
                📁 {kb.name}
              </a>
              <p className="text-sm text-gray-500">{kb.description || '暂无描述'}</p>
            </div>
            <button
              onClick={() => handleDelete(kb.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 第 8 步：知识库详情页 — `app/knowledge/[id]/page.tsx`

显示该知识库下的文档 + 上传新文件。

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDocuments, uploadDocument, deleteDocument } from '@/lib/api';

export default function KnowledgeDetailPage() {
  const params = useParams();
  const knowledgeBaseId = params.id as string;
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadDocuments = () => {
    getDocuments().then((docs) => {
      // 过滤出属于当前知识库的文档
      setDocuments(docs.filter((d: any) => d.knowledgeBaseId === knowledgeBaseId));
    });
  };

  useEffect(() => { loadDocuments(); }, [knowledgeBaseId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadDocument(file, knowledgeBaseId);
      loadDocuments();
    } catch (error) {
      console.error('上传失败:', error);
    } finally {
      setUploading(false);
      e.target.value = '';  // 清空 input，允许重复上传同一文件
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该文档？')) return;
    await deleteDocument(id);
    loadDocuments();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">知识库: {knowledgeBaseId}</h1>
      <p className="text-gray-500 mb-6">管理该知识库下的文档</p>

      {/* 上传区域 */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <label className="block">
          <span className="text-sm font-semibold">上传文档</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleUpload}
            disabled={uploading}
            className="block mt-2 text-sm"
          />
        </label>
        {uploading && <p className="text-sm text-blue-500 mt-2">上传解析中，请稍候...</p>}
      </div>

      {/* 文档列表 */}
      <div className="space-y-3">
        {documents.length === 0 && (
          <p className="text-gray-400 text-center py-8">暂无文档，请上传</p>
        )}
        {documents.map((doc: any) => (
          <div key={doc.id} className="bg-white rounded-lg border p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">📄 {doc.fileName}</p>
              <p className="text-sm text-gray-500">
                {doc.chunkCount} 个片段 · 状态: {doc.status}
              </p>
            </div>
            <button
              onClick={() => handleDelete(doc.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Next.js 环境变量详解

### 环境变量文件有哪些？

Next.js 支持多个 `.env` 文件，按**优先级从高到低**加载：

| 文件 | 什么时候加载 | 是否提交 Git | 用途 |
|------|------------|-------------|------|
| `.env.local` | **所有环境**，优先级最高 | **不提交**（自动在 .gitignore 里） | 本地敏感信息（密钥、个人配置） |
| `.env.development` | 仅 `next dev` | 可以提交 | 开发环境配置 |
| `.env.production` | 仅 `next build` / `next start` | 可以提交 | 生产环境配置 |
| `.env` | 所有环境，优先级最低 | 可以提交 | 所有环境共用的默认值 |

### 加载顺序

```
运行 next dev（开发环境）时：
  .env.local          ← 最高优先级，有就用这个
  .env.development    ← 其次
  .env                ← 兜底

运行 next build / next start（生产环境）时：
  .env.local          ← 最高优先级
  .env.production     ← 其次
  .env                ← 兜底

同名变量，高优先级的覆盖低优先级的。
```

### NEXT_PUBLIC_ 前缀规则

Next.js 对环境变量有一个**安全限制**：只有以 `NEXT_PUBLIC_` 开头的变量才能在浏览器端访问。

```bash
# 浏览器端能读到（暴露给用户，不要放密钥）
NEXT_PUBLIC_API_BASE=http://localhost:3000    ✅

# 只有服务端能读到（保护密钥，浏览器拿不到）
SECRET_API_KEY=sk-xxx                          ✅ 安全

# 浏览器端读不到（缺少 NEXT_PUBLIC_ 前缀）
API_BASE=http://localhost:3000                 ❌ 浏览器中 undefined
```

**为什么要这样设计？**

```
前端代码会被打包发送到用户浏览器。
如果所有环境变量都能在前端访问，那么：

  SECRET_API_KEY=sk-xxx
    ↓ 打包
  浏览器 JS 代码中出现 "sk-xxx"
    ↓
  用户打开 F12 就能看到你的密钥 💀

所以 Next.js 默认不暴露环境变量，只有你主动加 NEXT_PUBLIC_ 前缀的才会打包进前端代码。
这是一个"默认安全"的设计。
```

### 实际用法示例

```bash
# .env（提交 Git，所有环境共用的默认值）
NEXT_PUBLIC_APP_NAME=AI知识库

# .env.development（提交 Git，开发环境）
NEXT_PUBLIC_API_BASE=http://localhost:3000

# .env.production（提交 Git，生产环境）
NEXT_PUBLIC_API_BASE=https://api.example.com

# .env.local（不提交 Git，本地覆盖，放密钥等敏感信息）
NEXT_PUBLIC_API_BASE=http://localhost:3001
SECRET_API_KEY=sk-xxx
```

### 我们的项目怎么用

现阶段只需要一个 `.env.local`：

```bash
# frontend/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:3000
```

代码中读取：

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';
```

等以后要部署到线上时，再加 `.env.production`。不用提前搞复杂。

### 对比后端的 .env

| | 后端（NestJS） | 前端（Next.js） |
|------|--------------|---------------|
| 文件 | 只有 `.env` | 多个文件按环境区分 |
| 读取方式 | `process.env.XXX` 或 ConfigModule | `process.env.NEXT_PUBLIC_XXX` |
| 安全限制 | 无（服务端代码不暴露给用户） | 必须加 `NEXT_PUBLIC_` 前缀才能在浏览器端访问 |
| 多环境 | 手动管理 | 自动按 dev/production 加载不同文件 |

---

## 同时启动前后端服务

开发时需要同时运行前端（Next.js）和后端（NestJS），每次开两个终端窗口太麻烦。以下是五种方案，从简单到复杂。

### 方案 1：concurrently（推荐）

最流行的并行命令工具，中小型项目首选。

#### 安装

```bash
# -w 表示安装到 workspace 根目录
cd /Users/yujing/Desktop/2026-web3/ai-knowledge
pnpm add -D concurrently -w
```

#### 配置

修改**根目录** `package.json`：

```json
{
  "scripts": {
    "dev": "concurrently -n backend,frontend -c blue,green \"pnpm --filter backend run dev\" \"pnpm --filter frontend run dev\"",
    "dev:backend": "pnpm --filter backend run dev",
    "dev:frontend": "pnpm --filter frontend run dev"
  }
}
```

#### 参数说明

```bash
concurrently
  -n backend,frontend      # 给每个进程起名字，日志前面会显示 [backend] [frontend]
  -c blue,green            # 名字的颜色，方便区分
  "命令1" "命令2"            # 要并行执行的命令，用引号包裹
```

#### 使用

```bash
# 一条命令同时启动前后端
pnpm dev

# 终端输出效果：
# [backend] [Nest] 12345  - LOG [NestApplication] Nest application successfully started
# [frontend] ▲ Next.js 15.x
# [frontend] - Local: http://localhost:3001
# [backend] 蓝色字体 ↑
# [frontend] 绿色字体 ↑
```

#### 高级用法

```bash
# 其中一个挂了自动重启
concurrently --restart-tries 3 "cmd1" "cmd2"

# 其中一个退出时全部停止（适合测试场景）
concurrently --kill-others "cmd1" "cmd2"

# 加上前缀时间戳
concurrently -t "HH:mm:ss" "cmd1" "cmd2"
```

---

### 方案 2：pnpm --parallel（零依赖）

pnpm workspace 原生支持，不需要装任何额外的包。

#### 配置

前提：前后端的启动命令名**必须一样**。我们已经把后端的 `start:dev` 改成了 `dev`，前端默认就是 `dev`，满足条件。

根目录 `package.json`：

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel run dev"
  }
}
```

#### 参数说明

```bash
pnpm
  -r              # recursive，递归所有 workspace 子包
  --parallel      # 并行执行（默认是按依赖顺序串行的）
  run dev         # 执行每个子包的 dev 脚本
```

#### 使用

```bash
pnpm dev
```

#### 缺点

- 日志混在一起，没有颜色区分，不好看
- 不能给每个包配不同的命令名
- 如果某个包没有 `dev` 脚本会报警告

#### 过滤指定包

```bash
# 只启动后端
pnpm --filter backend run dev

# 只启动前端
pnpm --filter frontend run dev

# 同时启动两个指定的包
pnpm --filter backend --filter frontend --parallel run dev
```

---

### 方案 3：Turborepo（大型 monorepo）

Vercel 出品的 monorepo 构建系统，支持任务缓存、依赖图、增量构建。适合 5 个包以上的大型项目。

#### 安装

```bash
pnpm add -D turbo -w
```

#### 配置

在项目根目录创建 `turbo.json`：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "persistent": true,
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "lint": {},
    "test": {}
  }
}
```

#### 参数说明

```json
{
  "dev": {
    "persistent": true,    // 标记为长时间运行的任务（dev server 不会自己结束）
    "cache": false          // dev 不需要缓存
  },
  "build": {
    "dependsOn": ["^build"], // 先构建依赖的包，再构建自己（如果有 shared 包）
    "outputs": ["dist/**"]   // 构建产物路径，用于缓存
  }
}
```

#### 使用

```bash
# 并行启动所有包的 dev
turbo dev

# 构建所有包（自动处理依赖顺序 + 缓存）
turbo build

# 只跑某个包
turbo dev --filter=backend
```

#### Turbo 的核心优势：缓存

```
第一次 turbo build：
  backend build   → 30s
  frontend build  → 45s
  总计: 75s

改了后端代码后再 turbo build：
  backend build   → 30s（重新构建）
  frontend build  → 0s（命中缓存，跳过！）← 这就是 Turbo 的价值
  总计: 30s
```

对于我们两个包的小项目，缓存优势不明显。但在 10+ 包的大型 monorepo 中，构建时间能从 10 分钟降到 1 分钟。

---

### 方案 4：Nx（企业级 monorepo）

和 Turborepo 类似但功能更强大，提供代码生成器、依赖图可视化、分布式缓存等。

#### 安装

```bash
pnpm add -D nx -w
```

#### 配置

在项目根目录创建 `nx.json`：

```json
{
  "$schema": "nx/schemas/nx-schema.json",
  "targetDefaults": {
    "dev": {
      "cache": false
    },
    "build": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

每个子包的 `package.json` 不需要改动，Nx 会自动识别 scripts。

#### 使用

```bash
# 并行启动所有包的 dev
npx nx run-many --target=dev --parallel

# 只跑后端
npx nx run backend:dev

# 查看依赖关系图（浏览器中打开可视化界面）
npx nx graph

# 只跑受影响的包（比如只改了 shared，只重新构建依赖 shared 的包）
npx nx affected --target=build
```

#### Nx vs Turborepo

| | Turborepo | Nx |
|------|-----------|------|
| 定位 | 轻量级构建系统 | 全功能 monorepo 管理平台 |
| 配置量 | 少（一个 turbo.json） | 多（nx.json + project.json） |
| 代码生成 | 无 | 有（nx generate） |
| 依赖图可视化 | 无 | 有（nx graph） |
| 插件生态 | 少 | 丰富（React、Next.js、Nest 等官方插件） |
| 学习成本 | 低 | 中高 |
| 适合 | 5-20 个包 | 20+ 个包，企业级 |

---

### 方案 5：docker-compose（微服务架构）

每个服务跑在独立的 Docker 容器里，完全隔离。适合生产部署和复杂的多服务架构。

#### 前提

需要安装 Docker Desktop：https://www.docker.com/products/docker-desktop/

#### 配置

在项目根目录创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./backend/src:/app/src    # 代码变更同步到容器（开发模式）
    depends_on:
      - chromadb

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_BASE=http://localhost:3000

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma   # 数据持久化

volumes:
  chroma_data:
```

#### 使用

```bash
# 一键启动所有服务（后台运行）
docker-compose up -d

# 查看所有服务状态
docker-compose ps

# 查看某个服务的日志
docker-compose logs -f backend

# 停止所有服务
docker-compose down

# 停止并删除数据卷（清空数据）
docker-compose down -v

# 重新构建镜像（代码改了 Dockerfile 后）
docker-compose build
```

#### 需要为每个服务写 Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
CMD ["node", "dist/main"]
```

#### docker-compose 的优势

```
不用 docker-compose（手动启动）：
  终端 1: cd backend && pnpm dev
  终端 2: cd frontend && pnpm dev
  终端 3: chroma run
  终端 4: ollama serve
  → 4 个终端窗口，记不住谁在哪

用 docker-compose：
  docker-compose up -d
  → 一条命令，全部启动，全部隔离
```

#### 什么时候用 docker-compose

- 服务多（后端 + 前端 + 数据库 + ChromaDB + Ollama）
- 需要保证"我的电脑能跑 = 别人的电脑也能跑"
- 生产部署
- 团队协作（新人一条命令启动整个环境）

---

### 五种方案对比总结

| 方案 | 复杂度 | 适合规模 | 企业使用率 | 核心优势 |
|------|--------|---------|-----------|---------|
| **concurrently** | ⭐ | 2-5 个服务 | 高 | 简单，就是并行跑命令 |
| **pnpm --parallel** | ⭐ | 2-5 个包 | 中 | 零依赖 |
| **Turborepo** | ⭐⭐ | 5-20 个包 | 高（中大厂） | 任务缓存，增量构建 |
| **Nx** | ⭐⭐⭐ | 20+ 个包 | 高（大厂） | 全功能平台，代码生成 |
| **docker-compose** | ⭐⭐⭐ | 微服务 | 很高 | 环境隔离，一键部署 |

**我们的项目**：两个包（backend + frontend），用 **concurrently** 就够了。

---

## 跨域问题（CORS）

前端跑在 `localhost:3001`，后端跑在 `localhost:3000`，端口不同 = 跨域。

需要在后端 `main.ts` 中开启 CORS：

```ts
// 在 app.useGlobalPipes(...) 后面加一行
app.enableCors();
```

这一行允许任何来源的请求访问后端。开发环境够用了。

---

## 文件清单

| 文件 | 操作 |
|------|------|
| `pnpm-workspace.yaml` | **修改** — 加入 `frontend` |
| `backend/src/main.ts` | **修改** — 加 `app.enableCors()` |
| `frontend/src/lib/api.ts` | **新建** — API 调用封装 |
| `frontend/src/app/layout.tsx` | **修改** — 左右分栏布局 |
| `frontend/src/app/page.tsx` | **修改** — 对话页面（SSE 流式） |
| `frontend/src/components/Sidebar.tsx` | **新建** — 左侧栏 |
| `frontend/src/app/knowledge/page.tsx` | **新建** — 知识库管理 |
| `frontend/src/app/knowledge/[id]/page.tsx` | **新建** — 知识库详情 |

---

## 验收测试

### 测试 1：启动前端

```bash
cd frontend
pnpm dev
```

打开 `http://localhost:3000`（如果后端占了 3000，前端会自动用 3001）。

### 测试 2：知识库管理

1. 访问 `/knowledge`
2. 创建一个知识库（名称用英文如 `resume`）
3. 点进知识库详情
4. 上传一个 txt 文件
5. 等待状态变成 `done`

### 测试 3：AI 对话

1. 回到首页 `/`
2. 输入问题，点发送
3. 观察 AI 回答是否逐字出现（流式效果）
4. 检查多轮对话是否正常

### 关键验证点

- [ ] 左侧栏能显示知识库列表和对话列表
- [ ] 创建知识库 → 列表自动刷新
- [ ] 上传文件 → 状态从 uploading → done
- [ ] 发送消息 → AI 逐字流式回答
- [ ] 多轮对话 → AI 能理解上下文
- [ ] 无跨域报错（Console 里没有 CORS 错误）

---

## 常见报错速查表

| 报错 | 原因 | 解决 |
|------|------|------|
| `CORS policy: No 'Access-Control-Allow-Origin'` | 后端没开 CORS | `main.ts` 加 `app.enableCors()` |
| `Failed to fetch` | 后端没启动 | 确认后端在 3000 端口运行 |
| `fetch is not defined` | 服务端组件里用了 fetch | 加 `'use client'` |
| `useEffect is not defined` | 服务端组件里用了 hooks | 加 `'use client'` |
| 页面空白 | layout.tsx 没有 `{children}` | 确认 layout 中渲染了 children |
| 样式不生效 | TailwindCSS 没配好 | `create-next-app` 选了 Tailwind 就自动配好了 |
| 上传时 `Content-Type` 错误 | 手动设了 Content-Type | FormData 上传不要设 Content-Type header |
| SSE 没有逐字显示 | 一次性读完才渲染 | 确认 `while(true) reader.read()` 循环里有 `setMessages` |

---

## 知识图谱

```
前端页面
├── 技术栈
│   ├── Next.js — React 框架，文件系统路由
│   ├── TailwindCSS — 原子化 CSS，class 即样式
│   └── TypeScript — 类型安全
│
├── 核心页面
│   ├── 对话页 — SSE 流式消费 + 逐字渲染
│   ├── 知识库管理 — CRUD 操作
│   └── 知识库详情 — 文件上传 + 文档列表
│
├── 关键实现
│   ├── fetch + ReadableStream — 消费 SSE（POST 请求）
│   ├── FormData — 文件上传（不设 Content-Type）
│   ├── 'use client' — 客户端组件（需要交互/状态）
│   └── enableCors() — 解决跨域
│
└── 在系统中的位置
    后端 API ──→ [前端页面] ──→ 用户
                 ^^^^^^^^^^
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
第六步：RAG 对话            ✅
第七步：对话历史接口         ✅
第八步：前端页面            ← 你在这里
```

完成这一步后，整个 AI 知识库系统就**端到端跑通**了！
