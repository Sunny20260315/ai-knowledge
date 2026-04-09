# 第七步：对话历史接口

## 目标

实现对话历史相关接口，让前端能展示会话列表和每个会话中的消息记录。

```
需要新增的接口：

  GET  /chat/:sessionId/messages    获取某个会话的所有消息
  GET  /chat                         获取会话列表（已有，需优化：按时间倒序 + 返回最后一条消息摘要）
  DELETE /chat/:sessionId            删除会话及其所有消息（已有 remove，需优化：级联删除消息）
```

## 这一步在干什么？

```
上一步（第六步）完成了 RAG 对话，数据已经存入数据库：

  chat_session 表：
  ┌──────────┬────────────────────┬──────────────┐
  │ id       │ title              │ knowledgeBaseId │
  ├──────────┼────────────────────┼──────────────┤
  │ abc-123  │ NestJS怎么连接数... │ resume       │
  │ def-456  │ 文档讲了什么...     │ resume       │
  └──────────┴────────────────────┴──────────────┘

  chat_message 表：
  ┌──────────┬───────────┬───────────┬───────────────────────────────────┐
  │ sessionId│ role      │ content   │ references                        │
  ├──────────┼───────────┼───────────┼───────────────────────────────────┤
  │ abc-123  │ user      │ NestJS怎..│ null                              │
  │ abc-123  │ assistant │ 在NestJS..│ [{"content":"TypeORM是...","score":0.85}] │
  │ abc-123  │ user      │ 能详细说..│ null                              │
  │ abc-123  │ assistant │ 当然可以..│ [{"content":"...","score":0.79}]  │
  │ def-456  │ user      │ 文档讲了..│ null                              │
  │ def-456  │ assistant │ 这个文档..│ [{"content":"...","score":0.91}]  │
  └──────────┴───────────┴───────────┴───────────────────────────────────┘

这一步就是把这些数据通过接口暴露给前端。
```

### 前端需要什么数据？

```
场景 1：左侧会话列表
  前端请求：GET /chat
  需要的数据：
  ┌─────────────────────────────────┐
  │ 📋 NestJS怎么连接数据库...        │  ← 标题
  │    刚刚                          │  ← 时间
  ├─────────────────────────────────┤
  │ 📋 文档讲了什么...                │
  │    5分钟前                       │
  └─────────────────────────────────┘

场景 2：点击某个会话，加载历史消息
  前端请求：GET /chat/abc-123/messages
  需要的数据：
  ┌─────────────────────────────────┐
  │ 👤 NestJS怎么连接数据库？         │
  │                                   │
  │ 🤖 在NestJS中，你可以通过TypeORM  │
  │    来连接数据库... [1] [2]        │
  │    📎 引用来源: nestjs教程.pdf     │
  │                                   │
  │ 👤 能详细说说第一点吗？            │
  │                                   │
  │ 🤖 当然可以，TypeORM的配置...      │
  └─────────────────────────────────┘

场景 3：删除会话
  前端请求：DELETE /chat/abc-123
  需要的效果：会话 + 该会话下所有消息全部删除
```

---

## 实现步骤

### 核心改动

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/modules/chat/chat.controller.ts` | **修改** | 新增 `GET /chat/:sessionId/messages` |
| `src/modules/chat/chat.service.ts` | **修改** | 新增 `getMessages`，优化 `findAll` 和 `remove` |

不需要新建文件。

---

### 第 1 步：修改 ChatService — 新增和优化方法

#### 1.1 新增 `getMessages` 方法

获取某个会话下的所有消息，按时间正序排列。

```ts
/**
 * 获取会话的消息列表
 */
async getMessages(sessionId: string) {
  // 先确认会话存在
  const session = await this.chatRepository.findOne({ where: { id: sessionId } });
  if (!session) {
    throw new Error(`会话 ${sessionId} 不存在`);
  }

  // 查询该会话下所有消息，按创建时间正序
  const messages = await this.messageRepository.find({
    where: { sessionId },
    order: { createdAt: 'ASC' },
  });

  // 解析 references JSON 字符串为对象
  return {
    session,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      references: m.references ? JSON.parse(m.references) : null,
      createdAt: m.createdAt,
    })),
  };
}
```

#### 代码解释

```ts
references: m.references ? JSON.parse(m.references) : null,
```
- `references` 在数据库中存的是 JSON 字符串（第六步存入时用了 `JSON.stringify`）
- 返回给前端时解析成对象，前端直接用，不需要自己 parse
- 用户消息的 `references` 是 null，AI 消息的 `references` 是引用片段数组

#### 1.2 优化 `findAll` — 按时间倒序 + 消息数量

```ts
/**
 * 获取会话列表（按更新时间倒序）
 */
async findAll() {
  const sessions = await this.chatRepository.find({
    order: { updatedAt: 'DESC' },
  });

  // 为每个会话附加消息数量
  const result = await Promise.all(
    sessions.map(async (session) => {
      const messageCount = await this.messageRepository.count({
        where: { sessionId: session.id },
      });
      return {
        ...session,
        messageCount,
      };
    }),
  );

  return result;
}
```

#### 代码解释

```ts
order: { updatedAt: 'DESC' },
```
- 最近对话的排前面（和微信聊天列表一样）

```ts
const messageCount = await this.messageRepository.count({
  where: { sessionId: session.id },
});
```
- 附加消息数量，前端可以显示"共 N 条对话"
- `count()` 只统计数量，不查具体内容，性能好

#### 1.3 优化 `remove` — 级联删除消息

```ts
/**
 * 删除会话及其所有消息
 */
async remove(id: string) {
  // 先删该会话下的所有消息
  await this.messageRepository.delete({ sessionId: id });
  // 再删会话本身
  await this.chatRepository.delete(id);
  return { message: '会话及消息已删除' };
}
```

#### 为什么要先删消息再删会话？

```
如果直接删会话，消息还在数据库里，变成"孤儿数据"：

  chat_session 表：（会话已删）
  chat_message 表：
  │ sessionId: abc-123  │ ← 这条消息指向一个不存在的会话
  │ sessionId: abc-123  │ ← 又一条孤儿

正确顺序：先删子表（消息），再删主表（会话）
```

---

### 第 2 步：修改 ChatController — 新增消息历史接口

在 Controller 中新增一个路由，注意放在 `@Get(':id')` **前面**。

#### 新增方法

```ts
@Get(':sessionId/messages')
@ApiOperation({ summary: '获取会话消息历史' })
@ApiResponse({ status: 200, description: '返回会话信息和消息列表' })
async getMessages(@Param('sessionId') sessionId: string) {
  return this.chatService.getMessages(sessionId);
}
```

#### 路由顺序

```ts
@Get(':sessionId/messages')   // ← 放前面（更具体的路径）
@Get(':id')                    // ← 放后面（通配路径）
```

和第五步的搜索接口一样，NestJS 路由从上到下匹配。如果 `@Get(':id')` 在前面：
```
GET /chat/abc-123/messages
  → 匹配到 @Get(':id')  → id = "abc-123" → 把 "/messages" 丢了 → 结果不对
```

---

## 完整改动后的文件

### chat.service.ts

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { Chat } from './entities/chat.entity';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat.entity';
import { searchSimilar } from 'src/common/utils/vector-store.util';
import { buildRAGMessages, streamChat } from 'src/common/utils/llm.util';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  // ========== RAG 对话（第六步已有，不变）==========

  async *sendMessage(
    content: string,
    knowledgeBaseId?: string,
    sessionId?: string,
  ) {
    // ... 第六步的代码保持不变 ...
  }

  // ========== 新增 / 优化的方法 ==========

  /**
   * 获取会话消息历史
   */
  async getMessages(sessionId: string) {
    const session = await this.chatRepository.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new Error(`会话 ${sessionId} 不存在`);
    }

    const messages = await this.messageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });

    return {
      session,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        references: m.references ? JSON.parse(m.references) : null,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * 获取会话列表（按更新时间倒序 + 消息数量）
   */
  async findAll() {
    const sessions = await this.chatRepository.find({
      order: { updatedAt: 'DESC' },
    });

    const result = await Promise.all(
      sessions.map(async (session) => {
        const messageCount = await this.messageRepository.count({
          where: { sessionId: session.id },
        });
        return {
          ...session,
          messageCount,
        };
      }),
    );

    return result;
  }

  // ========== 以下方法保持不变或小改 ==========

  create(createChatDto: CreateChatDto) {
    const chat = this.chatRepository.create(createChatDto);
    return this.chatRepository.save(chat);
  }

  findOne(id: string) {
    return this.chatRepository.findOne({ where: { id } });
  }

  update(id: string, updateChatDto: UpdateChatDto) {
    return this.chatRepository.update(id, updateChatDto);
  }

  /**
   * 删除会话及其所有消息（优化：级联删除）
   */
  async remove(id: string) {
    await this.messageRepository.delete({ sessionId: id });
    await this.chatRepository.delete(id);
    return { message: '会话及消息已删除' };
  }
}
```

### chat.controller.ts

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
import { ChatService } from './chat.service';
import { Response } from 'express';
import { CreateChatDto, SendChatMessageDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ========== RAG 对话（第六步已有，不变）==========

  @Post('message')
  @ApiOperation({ summary: 'RAG 对话（流式输出）' })
  @ApiBody({ type: SendChatMessageDto })
  @ApiResponse({ status: 200, description: 'SSE 流式返回 AI 回答' })
  async sendMessage(@Body() dto: SendChatMessageDto, @Res() res: Response) {
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
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: error.message })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  // ========== 新增：消息历史 ==========

  @Get(':sessionId/messages')
  @ApiOperation({ summary: '获取会话消息历史' })
  @ApiResponse({ status: 200, description: '返回会话信息和消息列表' })
  async getMessages(@Param('sessionId') sessionId: string) {
    return this.chatService.getMessages(sessionId);
  }

  // ========== 以下是原有 CRUD ==========

  @Post()
  @ApiOperation({ summary: '创建聊天' })
  @ApiResponse({ status: 201, description: '聊天创建成功' })
  create(@Body() createChatDto: CreateChatDto) {
    return this.chatService.create(createChatDto);
  }

  @Get()
  @ApiOperation({ summary: '获取会话列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  findAll() {
    return this.chatService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个会话' })
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
  @ApiOperation({ summary: '删除会话（含消息）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.chatService.remove(id);
  }
}
```

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `src/modules/chat/chat.service.ts` | **修改** — 新增 `getMessages`，优化 `findAll`（倒序+消息数）和 `remove`（级联删除） |
| `src/modules/chat/chat.controller.ts` | **修改** — 新增 `GET /chat/:sessionId/messages` |

---

## 工具介绍：jq — 命令行 JSON 处理神器

### 什么是 jq？

`jq` 是一个命令行 JSON 处理工具，主要用来**格式化**和**过滤** JSON 数据。在后端开发中，经常要用 curl 测试接口，返回的 JSON 是压缩的一行，`jq` 可以让它变得好看、好读。

```
没有 jq：
  curl http://localhost:3000/chat
  [{"id":"abc-123","title":"NestJS怎么连接数...","knowledgeBaseId":"resume","createdAt":"2026-04-03T12:00:00","messageCount":4},{"id":"def-456","title":"文档讲了什么...","knowledgeBaseId":"resume","createdAt":"2026-04-03T11:30:00","messageCount":2}]

  → 一坨挤在一行，眼睛看花

有 jq：
  curl http://localhost:3000/chat | jq .
  [
    {
      "id": "abc-123",
      "title": "NestJS怎么连接数...",
      "knowledgeBaseId": "resume",
      "createdAt": "2026-04-03T12:00:00",
      "messageCount": 4
    },
    {
      "id": "def-456",
      "title": "文档讲了什么...",
      "knowledgeBaseId": "resume",
      "createdAt": "2026-04-03T11:30:00",
      "messageCount": 2
    }
  ]

  → 缩进清晰，还有颜色高亮（终端中）
```

### 安装

```bash
# macOS
brew install jq

# Ubuntu / Debian
sudo apt install jq

# 验证安装
jq --version
```

### 基本语法

```bash
# 管道符 | 把 curl 的输出传给 jq
curl http://xxx | jq '过滤表达式'
```

`|` 是 Linux/macOS 的**管道符**：把前面命令的输出，当作后面命令的输入。就像一根管子，数据从左边流到右边。

### 常用命令

#### 1. 格式化输出 — `jq .`

最常用，`.` 表示"原样输出，只做格式化"。

```bash
curl http://localhost:3000/chat | jq .
```

#### 2. 取某个字段 — `jq '.字段名'`

```bash
# 假设返回 {"session": {...}, "messages": [...]}
# 只取 messages 数组
curl http://localhost:3000/chat/abc-123/messages | jq '.messages'

# 取嵌套字段
curl http://localhost:3000/chat/abc-123/messages | jq '.session.title'
# 输出: "NestJS怎么连接数..."
```

#### 3. 取数组中的元素 — `jq '.[索引]'`

```bash
# 取数组第一个元素
curl http://localhost:3000/chat | jq '.[0]'

# 取第一个元素的 title 字段
curl http://localhost:3000/chat | jq '.[0].title'
# 输出: "NestJS怎么连接数..."

# 取最后一个元素
curl http://localhost:3000/chat | jq '.[-1]'
```

#### 4. 提取数组中每个元素的某个字段 — `jq '.[].字段名'`

```bash
# 取所有会话的标题
curl http://localhost:3000/chat | jq '.[].title'
# 输出:
# "NestJS怎么连接数..."
# "文档讲了什么..."

# 取所有消息的 content
curl http://localhost:3000/chat/abc-123/messages | jq '.messages[].content'
```

#### 5. 筛选 — `jq '.[] | select(条件)'`

```bash
# 只看 AI 回答（role 为 assistant）
curl http://localhost:3000/chat/abc-123/messages | jq '.messages[] | select(.role == "assistant")'

# 只看消息数大于 2 的会话
curl http://localhost:3000/chat | jq '.[] | select(.messageCount > 2)'
```

#### 6. 统计数量 — `jq 'length'`

```bash
# 有多少个会话
curl http://localhost:3000/chat | jq 'length'
# 输出: 2

# 某个会话有多少条消息
curl http://localhost:3000/chat/abc-123/messages | jq '.messages | length'
# 输出: 4
```

#### 7. 只看 key 名 — `jq 'keys'`

```bash
# 看返回的 JSON 有哪些字段（不看值）
curl http://localhost:3000/chat/abc-123/messages | jq 'keys'
# 输出: ["messages", "session"]
```

#### 8. 紧凑输出 — `jq -c`

和格式化相反，把 JSON 压缩成一行（适合存文件或传给其他程序）。

```bash
curl http://localhost:3000/chat | jq -c '.[]'
# 每条记录压缩成一行
# {"id":"abc-123","title":"NestJS怎么连接数...","messageCount":4}
# {"id":"def-456","title":"文档讲了什么...","messageCount":2}
```

#### 9. 原始字符串输出 — `jq -r`

去掉字符串的引号（适合赋值给 shell 变量）。

```bash
# 有引号
curl http://localhost:3000/chat | jq '.[0].id'
# 输出: "abc-123-xxx"

# 没引号（-r = raw）
curl http://localhost:3000/chat | jq -r '.[0].id'
# 输出: abc-123-xxx

# 常见用法：把 id 赋值给变量
SESSION_ID=$(curl -s http://localhost:3000/chat | jq -r '.[0].id')
curl http://localhost:3000/chat/$SESSION_ID/messages | jq .
```

### 组合示例（结合我们的接口）

```bash
# 1. 查看所有会话标题和消息数
curl -s http://localhost:3000/chat | jq '.[] | {title, messageCount}'
# {
#   "title": "NestJS怎么连接数...",
#   "messageCount": 4
# }

# 2. 查看某会话中 AI 的所有回答
curl -s http://localhost:3000/chat/abc-123/messages | jq '.messages[] | select(.role == "assistant") | .content'

# 3. 查看某会话中引用分数最高的来源
curl -s http://localhost:3000/chat/abc-123/messages | jq '.messages[] | select(.references != null) | .references[0]'

# 4. 一行命令：取第一个会话的消息历史
curl -s http://localhost:3000/chat | jq -r '.[0].id' | xargs -I{} curl -s http://localhost:3000/chat/{}/messages | jq .
```

### jq 速查表

| 命令 | 作用 | 示例 |
|------|------|------|
| `jq .` | 格式化 | `curl ... \| jq .` |
| `jq '.key'` | 取字段 | `jq '.title'` |
| `jq '.[0]'` | 取数组元素 | `jq '.[0]'` |
| `jq '.[].key'` | 遍历取字段 | `jq '.[].title'` |
| `jq 'length'` | 统计数量 | `jq '.messages \| length'` |
| `jq 'keys'` | 查看所有字段名 | `jq 'keys'` |
| `jq 'select()'` | 筛选 | `jq '.[] \| select(.role=="user")'` |
| `jq -r` | 去引号 | `jq -r '.[0].id'` |
| `jq -c` | 压缩成一行 | `jq -c '.[]'` |

---

## 验收测试

### 前置条件

至少进行过一次 RAG 对话（数据库中有会话和消息记录）。

### 测试 1：获取会话列表

```bash
curl http://localhost:3000/chat | jq .
```

#### 期望返回

```json
[
  {
    "id": "abc-123-xxx",
    "title": "NestJS怎么连接数...",
    "knowledgeBaseId": "resume",
    "createdAt": "2026-04-03T...",
    "updatedAt": "2026-04-03T...",
    "messageCount": 4
  }
]
```

**验证点**：
- [ ] 按更新时间倒序（最新的在前面）
- [ ] 包含 `messageCount` 字段

### 测试 2：获取会话消息

```bash
# 把 SESSION_ID 替换成上一步返回的会话 id
curl http://localhost:3000/chat/SESSION_ID/messages | jq .
```

#### 期望返回

```json
{
  "session": {
    "id": "abc-123-xxx",
    "title": "NestJS怎么连接数...",
    "knowledgeBaseId": "resume"
  },
  "messages": [
    {
      "id": "msg-001",
      "role": "user",
      "content": "NestJS怎么连接数据库？",
      "references": null,
      "createdAt": "2026-04-03T..."
    },
    {
      "id": "msg-002",
      "role": "assistant",
      "content": "在NestJS中，你可以通过TypeORM来连接数据库...",
      "references": [
        {
          "content": "TypeORM是NestJS中最常用的ORM框架...",
          "metadata": { "fileName": "test.txt", "chunkIndex": 0 },
          "score": 0.85
        }
      ],
      "createdAt": "2026-04-03T..."
    }
  ]
}
```

**验证点**：
- [ ] `messages` 按时间正序排列（最早的在前面）
- [ ] 用户消息的 `references` 是 `null`
- [ ] AI 消息的 `references` 是数组，包含引用片段和分数
- [ ] `session` 信息完整

### 测试 3：删除会话

```bash
# 删除会话
curl -X DELETE http://localhost:3000/chat/SESSION_ID | jq .

# 确认删除成功 — 会话列表不再包含该会话
curl http://localhost:3000/chat | jq .

# 确认消息也被删除 — 返回错误（会话不存在）
curl http://localhost:3000/chat/SESSION_ID/messages | jq .
```

### 测试 4：Swagger 测试

打开 `http://localhost:3000/api`，在 chat 分组下能看到新增的 `GET /chat/{sessionId}/messages` 接口。

---

## 常见报错速查表

| 报错 | 原因 | 解决 |
|------|------|------|
| `Cannot GET /chat/xxx/messages` | 路由未生效或顺序不对 | `@Get(':sessionId/messages')` 放在 `@Get(':id')` 前面 |
| `会话 xxx 不存在` | sessionId 错误 | 先调 `GET /chat` 确认有效的会话 ID |
| `references` 返回字符串而不是对象 | 没做 `JSON.parse` | 确认 service 中 map 了 `JSON.parse(m.references)` |
| 消息顺序混乱 | 没指定排序 | 确认 `order: { createdAt: 'ASC' }` |
| 删除会话后消息还在 | 没做级联删除 | 确认 `remove` 方法先删消息再删会话 |

---

## 知识图谱（这一步你学到了什么）

```
对话历史接口
├── 接口设计
│   ├── GET /chat — 会话列表（倒序 + 消息数量）
│   ├── GET /chat/:sessionId/messages — 消息详情
│   └── DELETE /chat/:id — 级联删除（先子后主）
│
├── 数据处理
│   ├── JSON.parse — 数据库中的 JSON 字符串 → 前端可用的对象
│   ├── Promise.all + map — 并行查询每个会话的消息数量
│   └── count() — 只统计数量不查内容，性能更好
│
├── NestJS 路由
│   ├── 嵌套路径 @Get(':sessionId/messages') — RESTful 资源嵌套
│   └── 路由顺序 — 具体路径放通配路径前面
│
└── 级联删除
    ├── 为什么不直接删主表 — 会产生孤儿数据
    └── 正确顺序 — 先删子表（消息），再删主表（会话）
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
第七步：对话历史接口         ← 你在这里
第八步：前端页面（下一步）
```

完成这一步后，后端 API 全部就绪，可以开始做前端了。
