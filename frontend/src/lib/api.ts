const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

// ==================== 知识库 ====================

/** 获取知识库列表 */
export async function getKnowledgeBases() {
  const res = await fetch(`${API_BASE}/knowledge-base`);
  return res.json();
}

/** 创建知识库 */
export async function createKnowledgeBase(data: {
  name: string;
  description?: string;
}) {
  const res = await fetch(`${API_BASE}/knowledge-base`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 删除知识库 */
export async function deleteKnowledgeBase(id: string) {
  const res = await fetch(`${API_BASE}/knowledge-base/${id}`, {
    method: 'DELETE',
  });
  return res.json();
}

/** 获取单个知识库详情 */
export async function getKnowledgeBase(id: string) {
  const res = await fetch(`${API_BASE}/knowledge-base/${id}`);
  return res.json();
}

/** 更新知识库 */
export async function updateKnowledgeBase(
  id: string,
  data: { name?: string; description?: string },
) {
  const res = await fetch(`${API_BASE}/knowledge-base/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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
    body: formData, // 注意：FormData 不要设置 Content-Type，浏览器会自动加 boundary
  });
  return res.json();
}

/** 获取文档处理进度 */
export async function getDocumentProgress(documentId: string) {
  const res = await fetch(`${API_BASE}/document-parse/${documentId}/progress`);
  return res.json();
}

/** 获取文档列表 */
export async function getDocuments() {
  const res = await fetch(`${API_BASE}/document-parse`);
  return res.json();
}

/** 解析网页 URL */
export async function parseUrl(url: string, knowledgeBaseId: string) {
  const res = await fetch(`${API_BASE}/document-parse/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, knowledgeBaseId }),
  });
  return res.json();
}

/** 生成文档摘要 */
export async function generateDocumentSummary(id: string) {
  const res = await fetch(`${API_BASE}/document-parse/${id}/summary`, {
    method: 'POST',
  });
  return res.json();
}

/** 删除文档 */
export async function deleteDocument(id: string) {
  const res = await fetch(`${API_BASE}/document-parse/${id}`, {
    method: 'DELETE',
  });
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
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

/** 更新会话（重命名、置顶等） */
export async function updateChatSession(id: string, data: { title?: string; isPinned?: boolean }) {
  const res = await fetch(`${API_BASE}/chat/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
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
export async function semanticSearch(
  q: string,
  knowledgeBaseId: string,
  topK = 5,
) {
  const res = await fetch(
    `${API_BASE}/search/query?q=${encodeURIComponent(q)}&knowledgeBaseId=${knowledgeBaseId}&topK=${topK}`,
  );
  return res.json();
}
