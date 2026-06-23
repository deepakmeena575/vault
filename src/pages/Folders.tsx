import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Folder } from '../types';
import { Folder as FolderIcon, Plus, Trash2, Edit2 } from 'lucide-react';

export const Folders: React.FC = () => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    if (!user) return;
    const { data } = await supabase.from('folders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setFolders(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from('folders').insert([{ user_id: user.id, folder_name: newFolderName }]);
    if (!error) {
      setNewFolderName('');
      await fetchFolders();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this folder?')) {
      await supabase.from('folders').delete().eq('id', id);
      fetchFolders();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex flex-col md:flex-row md:items-start justify-between mb-10 shrink-0">
        <h1 className="text-5xl font-extrabold tracking-tight mb-2">Folders</h1>
      </header>

      <div className="vault-card p-6 mb-10 shrink-0">
        <form onSubmit={handleCreate} className="flex gap-4">
          <input
            type="text"
            className="flex-1 input-field border border-slate-200 rounded-xl px-4 py-3 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 focus:bg-white transition-colors"
            placeholder="New folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Plus size={20} />
            Create
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto pb-8">
        {folders.map(folder => (
          <div key={folder.id} className="vault-card p-5 group cursor-pointer hover:border-indigo-300 transition-all flex flex-col items-center relative">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-4 group-hover:bg-indigo-100 transition-colors">
              <FolderIcon size={32} />
            </div>
            <h3 className="font-bold text-slate-800 text-center truncate w-full">{folder.folder_name}</h3>
            <p className="text-xs text-slate-400 mt-1">{new Date(folder.created_at).toLocaleDateString()}</p>
            
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); handleDelete(folder.id); }} className="p-2 bg-white text-red-500 hover:bg-red-50 rounded-lg border border-slate-200 shadow-sm">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {folders.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 font-medium">
            No folders created yet. Create your first folder above!
          </div>
        )}
      </div>
    </div>
  );
};
