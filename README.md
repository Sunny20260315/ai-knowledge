# 个人知识库搭建

## 核心功能：

Module 1: Document（文档管理）

- POST /documents/upload — 上传文件，解析 → 切片 → 向量化 → 存入 ChromaDB
- GET /documents — 列表（支持分页、按知识库筛选）
- GET /documents/:id — 详情
- DELETE /documents/:id — 删除文档及其向量

Module 2: Knowledge Base（知识库分类）

- POST /knowledge-bases — 创建知识库（如「前端笔记」「AI 论文」）
- GET /knowledge-bases — 列表
- PUT /knowledge-bases/:id — 编辑
- DELETE /knowledge-bases/:id — 删除

Module 3: Chat（AI 对话）

- POST /chat — 发送问题，基于知识库 RAG 回答
- GET /chat/history — 对话历史
- DELETE /chat/history/:id — 删除对话

Module 4: Search（语义搜索）

- GET /search?q=xxx\&kb=xxx — 跨文档语义搜索

