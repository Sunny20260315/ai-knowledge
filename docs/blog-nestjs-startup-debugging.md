# NestJS 项目启动报错排查实录：从"一片空白"到成功运行，我踩了 6 个坑

> 搭建个人 AI 知识库后端，NestJS + TypeORM + SQLite + Swagger，启动后终端一片空白，Swagger 打不开。从零开始排查，连环踩坑 6 次，每一个都够你喝一壶。

## 背景

技术栈：NestJS + TypeORM + better-sqlite3 + Swagger + pnpm monorepo

目标很简单：`pnpm run start:dev`，然后浏览器打开 `http://localhost:3000/api` 看到 Swagger 文档页面。

现实很骨感：终端一片空白，浏览器打不开，没有任何报错信息。

下面是完整的排查过程，按照踩坑顺序记录。

---

## 坑 1：SQLite 驱动找不到

### 报错信息

```
DriverPackageNotInstalledError: SQLite package has not been found installed.
Please run "npm install sqlite3".
```

### 排查过程

明明 `package.json` 里有 `sqlite3`，为什么说没装？

检查 `node_modules`，发现包确实存在。但项目用的是 **pnpm monorepo**，这里有个关键区别：

**npm/yarn 的 node_modules（扁平结构）：**
```
node_modules/
├── typeorm/        ← 你装的
├── sqlite3/        ← 你装的
└── some-dep/       ← sqlite3 的子依赖，也提升到这里
```
所有包互相都能 `require` 到，不管有没有声明依赖。

**pnpm 的 node_modules（严格隔离）：**
```
node_modules/
├── .pnpm/
│   ├── typeorm@0.3.28/node_modules/typeorm/    ← 真实文件
│   └── sqlite3@6.0.1/node_modules/sqlite3/    ← 真实文件
├── typeorm → .pnpm/typeorm@0.3.28/...          ← 符号链接
└── sqlite3 → .pnpm/sqlite3@6.0.1/...          ← 符号链接
```
**每个包只能访问自己 `package.json` 里声明的依赖。** TypeORM 内部 `require('sqlite3')` 时，因为 `sqlite3` 不是 TypeORM 的直接依赖（而是可选的驱动），pnpm 不让它访问。

### 解决方案

项目里已经装了 `better-sqlite3`，直接换驱动：

```ts
// database.module.ts
TypeOrmModule.forRoot({
  type: 'better-sqlite3',  // 原来是 'sqlite'
  database: ':memory:',
})
```

### 知识点

> pnpm 的严格依赖隔离是特性不是 bug。它防止你的代码依赖"幽灵依赖"（没声明但碰巧能用的包）。遇到这类问题，先检查你用的驱动包是否在当前包的 `package.json` 中。

---

## 坑 2：原生模块二进制文件未编译

### 报错信息

```
Error: Could not locate the bindings file. Tried:
 → .../better-sqlite3/build/better_sqlite3.node
 → .../better-sqlite3/build/Release/better_sqlite3.node
 → ...（尝试了 13 个路径，全部不存在）
```

### 原因

`better-sqlite3` 是 C++ 原生模块，安装时需要编译成 `.node` 二进制文件。pnpm install 时可能跳过了编译步骤（常见于 monorepo 或 CI 环境）。

### 解决方案

进入包目录手动触发编译：

```bash
cd node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3
npx prebuild-install
```

编译成功后 `build/Release/better_sqlite3.node` 就存在了。

---

## 坑 3：timestamp 类型不兼容

### 报错信息

```
DataTypeNotSupportedError: Data type "timestamp" in "DocumentParse.createdAt"
is not supported by "better-sqlite3" database.
```

### 原因

从 `sqlite` 驱动切到 `better-sqlite3` 后，类型检查变严格了。SQLite 没有原生 `timestamp` 类型。

### 解决方案

Entity 中把 `timestamp` 改成 `datetime`：

```ts
// 改前
@CreateDateColumn({ type: 'timestamp' })
createdAt: Date;

// 改后
@CreateDateColumn({ type: 'datetime' })
createdAt: Date;
```

**注意：** 项目里所有 Entity 都要改，漏一个就炸一个。用全局搜索 `type: 'timestamp'` 一次性处理。

---

## 坑 4：ConfigService 找不到

### 报错信息

```
Nest could not find ConfigService element
(this provider does not exist in the current context)
```

### 原因

`main.ts` 里用了 `app.get(ConfigService)` 读取端口配置，但 `AppModule` 里没有导入 `ConfigModule`。NestJS 的依赖注入系统找不到这个 provider。

### 解决方案

```ts
// app.module.ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env' }),
    // ...其他模块
  ],
})
export class AppModule {}
```

---

## 坑 5：终端一片空白，以为没启动

### 现象

运行 `nest start`，终端没有任何输出，进程直接退出。既不报错，也不打印 "Nest application successfully started"。

### 排查过程

1. `nest build` 编译成功 → 不是编译问题
2. `node dist/main.js` 也无输出 → 不是 nest CLI 的问题
3. `node --trace-warnings dist/main.js` 还是空白 → 不是 warning 被吞
4. 灵机一动，去看 **logger 配置**：

```ts
// logger.service.ts
transports: [
  new winston.transports.File({ filename: 'error.log', level: 'error' }),
  new winston.transports.File({ filename: 'combined.log' }),
  // 没有 Console transport！
],
```

所有日志都写进了文件，**终端当然什么都看不到！**

5. 查看 `error.log` 和 `combined.log`，真正的错误信息全在文件里。

### 解决方案

给 Winston 加上控制台输出：

```ts
transports: [
  // 加上这个
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
  new winston.transports.File({ filename: 'error.log', level: 'error' }),
  new winston.transports.File({ filename: 'combined.log' }),
],
```

### 教训

> **自定义 Logger 替换了 NestJS 默认 Logger 后，一定要保留控制台输出。** 否则所有启动信息、报错信息都被静默写入文件，你在终端看到的就是一片虚无。这是最容易被忽略的坑 —— 不是没有错，而是错误被藏起来了。

---

## 坑 6：模块依赖注入不完整

### 报错信息

加上控制台输出后，终于看到了真正的启动错误：

```
Nest can't resolve dependencies of the ChatService (?).
Please make sure that the argument "chat_ChatRepository" at index [0]
is available in the ChatModule module.
```

### 原因

`ChatService` 中注入了 `@InjectRepository(Chat, 'chat')`，但：
1. `database.module.ts` 里没有 `name: 'chat'` 的数据库连接
2. `chat.module.ts` 里没有 `TypeOrmModule.forFeature([Chat], 'chat')`

两边都缺，自然注入失败。

### 解决方案

**第一步**：database.module.ts 加 chat 连接

```ts
TypeOrmModule.forRoot({
  name: 'chat',
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [__dirname + '/../../modules/chat/**/*.entity{.ts,.js}'],
  synchronize: true,
}),
```

**第二步**：chat.module.ts 加 forFeature

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Chat, ChatMessage], 'chat')],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
```

---

## 坑外坑：端口被占用

排查过程中还发现一个问题：`localhost:3000` 返回的是 Next.js 的页面，不是 NestJS 的 Swagger。

用 `lsof -i :3000` 一查，端口被另一个项目的 Next.js 占了。NestJS 启动时端口冲突直接退出，但因为坑 5（控制台没输出），根本不知道。

```bash
# 查看端口占用
lsof -i :3000

# 释放端口
kill <PID>
```

---

## 总结：排查链路

```
Swagger 打不开
  → 访问 localhost:3000 返回 Next.js 页面
    → 端口被其他项目占用，kill 掉

  → NestJS 起不来，终端空白
    → Logger 只写文件没有控制台输出，加上 Console transport
    → 看到真正的错误：ChatService 依赖注入失败
      → database.module.ts 缺 chat 连接 + chat.module.ts 缺 forFeature

  → 数据库连接报错（之前的问题）
    → SQLite 驱动找不到 → pnpm 隔离，换 better-sqlite3
    → 原生二进制未编译 → 手动 prebuild-install
    → timestamp 类型不支持 → 改成 datetime
    → ConfigService 找不到 → AppModule 加 ConfigModule
```

一个看似简单的"Swagger 打不开"，背后是 6 个不同层面的问题叠加。**任何一个单独出现都不难解决，难的是它们同时存在、互相遮掩。**

## 给新手的排查清单

下次 NestJS 项目启动异常，按这个顺序查：

1. **端口是否被占** → `lsof -i :端口号`
2. **终端有没有输出** → 检查是否自定义了 Logger，控制台是否有 transport
3. **编译是否通过** → `nest build` 看有没有 TS 错误
4. **依赖注入是否完整** → 每个 Service 注入的 Repository，对应的 Module 和 Database 连接是否都配了
5. **数据库驱动是否匹配** → pnpm 用户特别注意隔离问题
6. **Entity 类型是否兼容** → 换数据库驱动后全局搜索类型关键词
