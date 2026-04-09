# NestJS + Swagger API 测试完整教程

> 基于本项目（ai-knowledge）的实战经验整理

## 目录

1. [Swagger 是什么](#1-swagger-是什么)
2. [安装与基础配置](#2-安装与基础配置)
3. [核心装饰器详解](#3-核心装饰器详解)
4. [完整使用示例](#4-完整使用示例)
5. [使用 Swagger UI 测试 API](#5-使用-swagger-ui-测试-api)
6. [踩坑记录与解决方案](#6-踩坑记录与解决方案)

---

## 1. Swagger 是什么

Swagger（OpenAPI）是一个 API 文档自动生成 + 在线测试工具。配置好之后：

- 访问 `http://localhost:3000/api` 就能看到所有 API 的文档页面
- 可以直接在页面上填参数、点按钮测试接口，不需要 Postman 或 curl

---

## 2. 安装与基础配置

### 2.1 安装依赖

```bash
pnpm add @nestjs/swagger
```

### 2.2 在 main.ts 中配置

```ts
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- Swagger 配置 ---
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Knowledge API')           // 文档标题
    .setDescription('AI 知识库系统 API 文档') // 文档描述
    .setVersion('1.0')                       // API 版本
    .addTag('document')                      // 标签（用于分组）
    .addTag('knowledge-base')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);
  //                    ^^^
  //                    访问路径：http://localhost:3000/api
  // --- Swagger 配置结束 ---

  await app.listen(3000);
}
```

### 2.3 验证

启动服务后，浏览器打开 `http://localhost:3000/api`，能看到 Swagger UI 页面就说明配置成功。

---

## 3. 核心装饰器详解

Swagger 通过装饰器来生成文档。分两类：**Controller 装饰器** 和 **DTO 装饰器**。

### 3.1 Controller 装饰器

```ts
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('document')  // 分组标签，Swagger UI 中按这个分类显示
@Controller('document-parse')
export class DocumentController {

  @Post()
  @ApiOperation({ summary: '创建文档' })           // 接口说明（简短）
  @ApiResponse({ status: 201, description: '创建成功' }) // 响应说明
  @ApiResponse({ status: 400, description: '参数错误' }) // 可以写多个
  create(@Body() dto: CreateDocumentDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个文档' })
  @ApiParam({ name: 'id', description: '文档ID' })  // 路径参数说明
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get()
  @ApiOperation({ summary: '搜索文档' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' }) // 查询参数
  search(@Query('keyword') keyword: string) {
    return this.service.search(keyword);
  }
}
```

### 3.2 DTO 装饰器

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ description: '文件名', example: 'readme.pdf' })
  //           ^^^^^^^^^^^                ^^^^^^^^^^^
  //           Swagger UI 显示的说明       Swagger UI 预填的示例值
  @IsString()      // class-validator 装饰器（必须有！原因见踩坑记录）
  @IsNotEmpty()
  fileName: string;

  @ApiPropertyOptional({ description: '备注' })  // 可选字段用这个
  @IsString()
  @IsOptional()    // 配合 class-validator 的 @IsOptional()
  remark?: string;
}
```

### 3.3 装饰器速查表

| 装饰器 | 用在哪 | 作用 |
|--------|--------|------|
| `@ApiTags('xxx')` | Controller 类 | 接口分组 |
| `@ApiOperation({ summary })` | 方法 | 接口说明 |
| `@ApiResponse({ status, description })` | 方法 | 响应码说明 |
| `@ApiParam({ name, description })` | 方法 | 路径参数 `:id` 说明 |
| `@ApiQuery({ name, required })` | 方法 | 查询参数 `?key=val` 说明 |
| `@ApiProperty({ description, example })` | DTO 属性 | 必填字段 |
| `@ApiPropertyOptional({...})` | DTO 属性 | 可选字段 |
| `@ApiBody({ type: XxxDto })` | 方法 | 指定请求体类型（通常自动推断） |

---

## 4. 完整使用示例

以本项目的 document 模块为例，展示一个完整的 Swagger 配置流程。

### 4.1 DTO（数据校验 + 文档）

```ts
// dto/create-document.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ description: '文件名' })
  @IsString()
  fileName: string;

  @ApiProperty({ description: '文件类型' })
  @IsString()
  fileType: string;

  @ApiProperty({ description: '文件大小' })
  @IsString()
  fileSize: string;
}
```

**关键点**：每个字段必须同时有 `@ApiProperty`（给 Swagger 看）和 `@IsString`（给 ValidationPipe 看）。

### 4.2 Controller（接口文档）

```ts
// document.controller.ts
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('document')                    // ← 步骤1：给 Controller 加分组标签
@Controller('document-parse')
export class DocumentController {

  @Post()
  @ApiOperation({ summary: '创建文档' })  // ← 步骤2：给每个方法加说明
  @ApiResponse({ status: 201, description: '文档创建成功' })
  create(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentService.create(createDocumentDto);
  }
}
```

### 4.3 main.ts（全局配置）

```ts
// main.ts —— 步骤3：注册 Swagger
const swaggerConfig = new DocumentBuilder()
  .setTitle('AI Knowledge API')
  .setDescription('AI 知识库系统 API 文档')
  .setVersion('1.0')
  .addTag('document')          // ← 与 @ApiTags('document') 对应
  .addTag('knowledge-base')
  .build();

const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api', app, document);
```

---

## 5. 使用 Swagger UI 测试 API

### 5.1 打开页面

浏览器访问：`http://localhost:3000/api`

### 5.2 测试步骤

```
1. 找到目标接口（按 Tag 分组）
2. 点击接口展开
3. 点击右上角 "Try it out" 按钮
4. 修改请求参数（JSON body / path param / query param）
5. 点击 "Execute" 发送请求
6. 查看下方的 Response body、Status code、Headers
```

### 5.3 curl 替代测试

Swagger UI 的 Execute 按钮下方会生成对应的 curl 命令，可以直接复制到终端使用：

```bash
curl -X 'POST' \
  'http://localhost:3000/document-parse' \
  -H 'Content-Type: application/json' \
  -d '{
  "fileName": "readme.pdf",
  "fileType": "pdf",
  "fileSize": "1024"
}'
```

### 5.4 JSON 文档地址

- Swagger UI：`http://localhost:3000/api`
- OpenAPI JSON：`http://localhost:3000/api-json`（可导入 Postman）

---

## 6. 踩坑记录与解决方案

### 坑1：数据库连接失败 — SQLite 驱动找不到

**报错**：
```
DriverPackageNotInstalledError: SQLite package has not been found installed.
Please run "npm install sqlite3".
```

**原因**：项目使用 pnpm monorepo，`type: 'sqlite'` 需要的 `sqlite3` 包被 pnpm 的严格依赖隔离机制挡住了。TypeORM 内部 `require('sqlite3')` 时，因为 `sqlite3` 不是 TypeORM 的直接依赖，pnpm 不允许访问。

**解决**：将数据库驱动从 `sqlite` 改为 `better-sqlite3`（项目已安装此包）：

```ts
// database.module.ts
TypeOrmModule.forRoot({
  type: 'better-sqlite3',  // ← 原来是 'sqlite'
  database: ':memory:',
  // ...
})
```

**知识点**：pnpm 的 node_modules 是严格隔离的，包只能访问自己 `package.json` 声明的依赖。npm/yarn 的扁平结构没有这个问题。

---

### 坑2：better-sqlite3 原生二进制未编译

**报错**：
```
Error: Could not locate the bindings file.
Tried: .../better-sqlite3/build/better_sqlite3.node
```

**原因**：`better-sqlite3` 是 C++ 原生模块，安装时需要编译。pnpm install 时可能跳过了编译步骤。

**解决**：
```bash
# 进入包目录手动触发编译
cd node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3
npx prebuild-install
```

---

### 坑3：timestamp 类型不兼容 better-sqlite3

**报错**：
```
DataTypeNotSupportedError: Data type "timestamp" in "DocumentParse.createdAt"
is not supported by "better-sqlite3" database.
```

**原因**：SQLite 没有原生的 `timestamp` 类型，`better-sqlite3` 驱动对类型检查更严格。

**解决**：Entity 中把 `timestamp` 改成 `datetime`：

```ts
// 修改前
@CreateDateColumn({ type: 'timestamp' })
createdAt: Date;

// 修改后
@CreateDateColumn({ type: 'datetime' })
createdAt: Date;
```

---

### 坑4：ConfigService 找不到

**报错**：
```
Nest could not find ConfigService element
(this provider does not exist in the current context)
```

**原因**：`main.ts` 中使用了 `app.get(ConfigService)`，但 `AppModule` 没有导入 `ConfigModule`。

**解决**：在 `app.module.ts` 中添加：

```ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    // ...其他模块
  ],
})
export class AppModule {}
```

---

### 坑5：POST 请求 500 — whitelist 过滤掉了所有字段（最隐蔽）

**报错**：
```json
{"statusCode": 500, "message": "Internal server error"}
```

实际底层错误（Nest 默认隐藏了）：
```
SqliteError: NOT NULL constraint failed: document_parse.fileName
```

**原因**：`main.ts` 配置了全局校验管道：

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,   // ← 这个选项会过滤掉没有 class-validator 装饰器的字段
  transform: true,
}));
```

而 DTO 中只写了 `@ApiProperty`（Swagger 装饰器），没有写 `@IsString`（class-validator 装饰器）：

```ts
// 错误写法 —— 字段会被 whitelist 过滤掉
export class CreateDocumentDto {
  @ApiProperty({ description: '文件名' })  // 只有 Swagger 装饰器
  fileName: string;                         // → 传入的值被丢弃！
}
```

`whitelist: true` 的规则是：**只保留有 class-validator 装饰器的字段，其余全部删除。** `@ApiProperty` 不是 class-validator 的装饰器，所以不算。

结果：请求体变成了空对象 `{}`，所有 NOT NULL 字段都没值，数据库报错。

**解决**：DTO 中每个字段必须同时加 Swagger + class-validator 装饰器：

```ts
// 正确写法
export class CreateDocumentDto {
  @ApiProperty({ description: '文件名' })   // Swagger 文档用
  @IsString()                                // class-validator 校验用（同时防止被 whitelist 过滤）
  fileName: string;
}
```

**记忆口诀**：`@ApiProperty` 管文档，`@IsString` 管校验，两个都要写，缺一个就出事。

---

## 附：排查 500 错误的通用方法

当 Nest 返回 `{"statusCode": 500, "message": "Internal server error"}` 时，默认不会暴露详细错误。排查方法：

### 方法1：看终端日志
Nest 启动的终端通常会打印完整的错误堆栈。

### 方法2：临时 try-catch
在 Controller 或 Service 中加临时的 try-catch 返回错误信息：

```ts
@Post()
async create(@Body() dto: CreateDocumentDto) {
  try {
    return await this.service.create(dto);
  } catch (error) {
    return { error: error.message, stack: error.stack }; // 临时调试用，排查完删掉
  }
}
```

### 方法3：关闭生产模式的错误隐藏
在开发环境中使用全局异常过滤器，返回完整错误信息（仅开发环境使用）。
