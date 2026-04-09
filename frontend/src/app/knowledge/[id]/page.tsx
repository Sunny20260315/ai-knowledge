'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Document, KnowledgeBase } from '@/types';
import { getDocuments, deleteDocument, uploadDocument, generateDocumentSummary, parseUrl, getKnowledgeBase } from '@/lib/api';

export default function KnowledgeDetailPage() {
  const params = useParams();
  const knowledgeBaseId = params.id as string;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({});
  const [urlInput, setUrlInput] = useState('');
  const [parsingUrl, setParsingUrl] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, boolean>>({});

  const loadDocuments = useCallback(() => {
    getDocuments().then((docs) => {
      setDocuments(
        docs.filter((d: Document) => d.knowledgeBaseId === knowledgeBaseId),
      );
    });
  }, [knowledgeBaseId]);

  const loadKnowledgeBase = useCallback(() => {
    getKnowledgeBase(knowledgeBaseId).then((kb) => {
      setKnowledgeBase(kb);
    }).catch((error) => {
      console.error('获取知识库失败:', error);
    });
  }, [knowledgeBaseId]);

  useEffect(() => {
    loadDocuments();
    loadKnowledgeBase();
  }, [knowledgeBaseId, loadDocuments, loadKnowledgeBase]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      await uploadDocument(file, knowledgeBaseId);
      setUploadProgress(100);
      loadDocuments();
    } catch (error) {
      console.error('上传失败:', error);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该文档？')) return;
    await deleteDocument(id);
    loadDocuments();
  };

  const handleGenerateSummary = async (docId: string) => {
    setSummarizing((prev) => ({ ...prev, [docId]: true }));
    try {
      const result = await generateDocumentSummary(docId);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, summary: result.summary } : d)),
      );
      setExpandedSummaries((prev) => ({ ...prev, [docId]: true }));
    } catch (error) {
      console.error('生成摘要失败:', error);
    } finally {
      setSummarizing((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    uploaded: { label: '已上传', color: 'text-gray-500' },
    parsing: { label: '解析中', color: 'text-yellow-600' },
    embedding: { label: '向量化中', color: 'text-blue-500' },
    done: { label: '已完成', color: 'text-green-600' },
    failed: { label: '失败', color: 'text-red-500' },
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="h-12 border-b border-gray-200 bg-white flex items-center px-5">
        <span className="text-sm text-gray-700 font-medium">
          知识库: {knowledgeBase?.name || knowledgeBaseId}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto">
          {/* 上传区域 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">文档管理</h2>
              <label className="text-sm text-blue-500 hover:text-blue-600 font-medium cursor-pointer transition-colors">
                + 上传文档
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {uploading && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-blue-500">上传解析中...</span>
                  <span className="text-xs text-gray-400">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-2">支持 PDF、DOCX、TXT、MD 格式</p>

            {/* URL 解析 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-800 mb-2">网页链接解析</p>
              <div className="flex gap-2">
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="粘贴网页链接，如 https://example.com/article"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                  disabled={parsingUrl}
                />
                <button
                  onClick={async () => {
                    if (!urlInput.trim()) return;
                    setParsingUrl(true);
                    try {
                      await parseUrl(urlInput.trim(), knowledgeBaseId);
                      setUrlInput('');
                      loadDocuments();
                    } catch (error) {
                      console.error('URL 解析失败:', error);
                    } finally {
                      setParsingUrl(false);
                    }
                  }}
                  disabled={parsingUrl || !urlInput.trim()}
                  className="text-sm bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {parsingUrl ? '解析中...' : '解析'}
                </button>
              </div>
            </div>
          </div>

          {/* 文档列表 */}
          {documents.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-300">
                  <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                  <path d="M9 2v4h4" />
                </svg>
              </div>
              <p className="text-sm">暂无文档，请上传</p>
            </div>
          )}

          <div className="space-y-3">
            {documents.map((doc: Document) => {
              const status = statusMap[doc.status] || { label: doc.status, color: 'text-gray-500' };
              const isSummarizing = summarizing[doc.id];
              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                >
                  {/* 文档信息行 */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-orange-400">
                          <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
                          <path d="M9 2v4h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                        <p className="text-xs text-gray-400">
                          {doc.chunkCount} 个片段
                          <span className={`ml-2 ${status.color}`}>{status.label}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {doc.status === 'done' && !doc.summary && (
                        <button
                          onClick={() => handleGenerateSummary(doc.id)}
                          disabled={isSummarizing}
                          className="text-xs text-blue-500 hover:text-blue-600 disabled:text-gray-300 transition-colors"
                        >
                          {isSummarizing ? '生成中...' : '生成摘要'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M3 4h10M6 4V3h4v1M5 4v8.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V4" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* 摘要区域 */}
                  {isSummarizing && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 019.8 8" strokeOpacity="0.75" strokeLinecap="round" />
                        </svg>
                        AI 正在分析文档内容...
                      </div>
                    </div>
                  )}

                  {doc.summary && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          onClick={() => setExpandedSummaries((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          核心知识点
                          <svg
                            width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                            className={`transition-transform ${expandedSummaries[doc.id] ? 'rotate-180' : ''}`}
                          >
                            <path d="M4 6l4 4 4-4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            // 清除已有摘要，重新生成
                            setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, summary: undefined } : d)));
                            handleGenerateSummary(doc.id);
                          }}
                          className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                        >
                          重新生成
                        </button>
                      </div>
                      {expandedSummaries[doc.id] && (
                        <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                          {doc.summary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
