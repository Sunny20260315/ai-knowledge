// 知识库
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// 文档
export interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  knowledgeBaseId: string;
  chunkCount: string;
  status: 'uploaded' | 'parsing' | 'embedding' | 'done' | 'failed';
  progress?: number; // 处理进度 0-100
  summary?: string; // AI 生成的核心知识点
  createdAt: string;
}

// 对话会话
export interface ChatSession {
  id: string;
  title: string;
  knowledgeBaseId: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

// 对话消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references: Reference[] | null;
  createdAt: string;
}

// 引用来源
export interface Reference {
  content: string;
  metadata: {
    documentId: string;
    fileName: string;
    chunkIndex: number;
  };
  score: number;
}
