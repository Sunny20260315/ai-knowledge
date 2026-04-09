'use client';
import { useEffect, useState } from 'react';
import { KnowledgeBase } from '@/types';
import {
  getKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  updateKnowledgeBase,
} from '@/lib/api';
import Link from 'next/link';

export default function KnowledgePage() {
  const [list, setList] = useState<KnowledgeBase[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const loadList = () => getKnowledgeBases().then(setList);

  useEffect(() => {
    loadList();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createKnowledgeBase({ name, description });
    setName('');
    setDescription('');
    setShowForm(false);
    loadList();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除？')) return;
    await deleteKnowledgeBase(id);
    loadList();
  };

  const startEdit = (kb: KnowledgeBase) => {
    setEditingId(kb.id);
    setEditName(kb.name);
    setEditDescription(kb.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    await updateKnowledgeBase(id, {
      name: editName,
      description: editDescription,
    });
    setEditingId(null);
    loadList();
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-5">
        <span className="text-sm text-gray-700 font-medium">知识库管理</span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors"
        >
          {showForm ? '取消' : '+ 新建知识库'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto">
          {/* 创建表单 */}
          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">新建知识库</h2>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="知识库名称（英文，如 resume）"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述（可选）"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400 transition-colors"
              />
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                创建
              </button>
            </div>
          )}

          {/* 知识库列表 */}
          {list.length === 0 && !showForm && (
            <div className="text-center py-20 text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-300">
                  <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1 1.5h5.5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" />
                </svg>
              </div>
              <p className="text-sm">暂无知识库，点击右上角创建</p>
            </div>
          )}

          <div className="space-y-2">
            {list.map((kb: KnowledgeBase) => {
              const isEditing = editingId === kb.id;
              
              return (
                <div
                  key={kb.id}
                  className="group bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                >
                  {isEditing ? (
                    // 编辑模式
                    <div>
                      <div className="mb-3">
                        <label className="text-xs text-gray-500 mb-1 block">名称</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                          placeholder="知识库名称"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="text-xs text-gray-500 mb-1 block">描述</label>
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                          placeholder="描述（可选）"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(kb.id)}
                          disabled={!editName.trim()}
                          className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-500 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 查看模式
                    <div className="flex justify-between items-center">
                      <Link
                        href={`/knowledge/${kb.id}`}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-blue-500">
                            <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1 1.5h5.5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{kb.name}</p>
                          <p className="text-xs text-gray-400 truncate">{kb.description || '暂无描述'}</p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2">
                        <button
                          onClick={() => startEdit(kb)}
                          className="text-gray-300 hover:text-blue-500 transition-colors p-1"
                          title="编辑"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(kb.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          title="删除"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M3 4h10M6 4V3h4v1M5 4v8.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V4" />
                          </svg>
                        </button>
                      </div>
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
