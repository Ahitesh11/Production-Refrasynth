import React, { useEffect, useState } from 'react';
import { DEPARTMENTS } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Plus,
  Trash2,
  Save,
  X,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ChevronDown,
  Pencil,
  Eye,
  EyeOff,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  scriptUrl: string;
}

interface SheetUser {
  username: string;
  type: string;
  permissions: Record<string, boolean>;
}

const USER_TYPES = ['Entry', 'Mark Done', 'Admin'];

// Fallback column order if the Login sheet doesn't exist yet / has no rows.
const DEFAULT_PERMISSION_COLUMNS = Array.from(new Set(DEPARTMENTS.map(d => d.name)));

interface Draft {
  type: string;
  password: string;
  permissions: Set<string>;
}

function draftFromUser(user: SheetUser): Draft {
  return {
    type: user.type || 'Entry',
    password: '',
    permissions: new Set(Object.entries(user.permissions).filter(([, v]) => v).map(([k]) => k)),
  };
}

export default function ManageUsers({ scriptUrl }: Props) {
  const [users, setUsers] = useState<SheetUser[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [newUser, setNewUser] = useState<{ username: string; password: string; type: string; permissions: Set<string> }>({
    username: '',
    password: '',
    type: 'Entry',
    permissions: new Set(),
  });

  const typeIdx = headers.indexOf('Type');
  const sheetReady = headers.length > 0;
  const permissionColumns = sheetReady
    ? headers.slice(2, typeIdx === -1 ? headers.length : typeIdx)
    : DEFAULT_PERMISSION_COLUMNS;

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const urlParam = scriptUrl ? `&url=${encodeURIComponent(scriptUrl)}` : '';
      const res = await fetch(`/api/proxy?action=getUsers${urlParam}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUsers(json.users || []);
      setHeaders(json.headers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptUrl]);

  const postToSheet = async (body: Record<string, any>) => {
    if (!scriptUrl) throw new Error('Google Apps Script URL is not configured in Settings.');
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(scriptUrl)}`;
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ sheetName: 'Login', ...body }),
    });
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch { throw new Error(`Server returned a non-JSON response: ${text.substring(0, 100)}`); }
    if (!res.ok || json.result === 'error') throw new Error(json.error || 'Request failed');
    return json;
  };

  const toggleExpand = (user: SheetUser) => {
    if (expanded === user.username) {
      setExpanded(null);
      setDraft(null);
    } else {
      setExpanded(user.username);
      setDraft(draftFromUser(user));
    }
  };

  const togglePermission = (set: Set<string>, col: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(col)) next.delete(col); else next.add(col);
    setter(next);
  };

  const handleSave = async (username: string) => {
    if (!draft) return;
    setBusyKey(username);
    setError(null);
    try {
      const partialData: Record<string, any> = { Type: draft.type };
      permissionColumns.forEach(col => {
        partialData[col] = draft.permissions.has(col) ? 'Yes' : '';
      });
      if (draft.password.trim()) partialData['Password'] = draft.password.trim();

      await postToSheet({ uniqueId: username, partialData });
      await load();
      setExpanded(null);
      setDraft(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Remove access for "${username}"? This deletes their row from the Login sheet.`)) return;
    setBusyKey(username);
    setError(null);
    try {
      await postToSheet({ action: 'deleteUser', uniqueId: username });
      await load();
      if (expanded === username) { setExpanded(null); setDraft(null); }
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleAdd = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      setError('Username and password are required.');
      return;
    }
    if (users.some(u => u.username.toLowerCase() === newUser.username.trim().toLowerCase())) {
      setError('That username already exists — edit it below instead.');
      return;
    }
    setBusyKey('__new__');
    setError(null);
    try {
      const values = headers.map(h => {
        if (h === 'Username') return newUser.username.trim();
        if (h === 'Password') return newUser.password.trim();
        if (h === 'Type') return newUser.type;
        return newUser.permissions.has(h) ? 'Yes' : '';
      });
      await postToSheet({ uniqueId: newUser.username.trim(), values });
      await load();
      setNewUser({ username: '', password: '', type: 'Entry', permissions: new Set() });
      setShowAdd(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add user.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">Manage Users</h1>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{users.length} user{users.length === 1 ? '' : 's'} • synced with the Login sheet</p>
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setError(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-600 transition-all shadow-lg shadow-slate-200"
        >
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {!sheetReady && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>No "Login" sheet found (or it has no header row) at that Script URL, so new users can't be created yet. Add a sheet named exactly <b>Login</b> with the header row shown below, then reload this page.</span>
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-3"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New User</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all outline-none text-sm font-medium text-slate-700"
                    placeholder="jdoe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                      className="w-full h-11 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all outline-none text-sm font-medium text-slate-700"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Access Level</label>
                  <select
                    value={newUser.type}
                    onChange={e => setNewUser(u => ({ ...u, type: e.target.value }))}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all outline-none text-sm font-medium text-slate-700"
                  >
                    {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {newUser.type !== 'Admin' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Department Access</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {permissionColumns.map(col => (
                      <label key={col} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 cursor-pointer hover:border-brand-300">
                        <input
                          type="checkbox"
                          checked={newUser.permissions.has(col)}
                          onChange={() => togglePermission(newUser.permissions, col, s => setNewUser(u => ({ ...u, permissions: s })))}
                          className="accent-brand-500 w-3.5 h-3.5"
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleAdd}
                  disabled={busyKey === '__new__' || !sheetReady}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-600 disabled:opacity-50 transition-all"
                >
                  {busyKey === '__new__' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create User
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm font-medium">Loading users...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
          <Users className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm font-medium text-slate-400">No users yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(user => {
            const isExpanded = expanded === user.username;
            const grantedCount = Object.values(user.permissions).filter(Boolean).length;
            return (
              <div key={user.username} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleExpand(user)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      {user.type === 'Admin' ? <ShieldCheck className="w-4 h-4 text-brand-600" /> : <UserIcon className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-bold text-slate-800 truncate">{user.username}</p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        {user.type || 'Entry'} • {user.type === 'Admin' ? 'Full Access' : `${grantedCount} department${grantedCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDelete(user.username); }}
                      role="button"
                      className="p-2 hover:bg-rose-50 rounded-lg transition-colors text-slate-300 hover:text-rose-600"
                      title="Delete user"
                    >
                      {busyKey === user.username && !isExpanded ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </span>
                    <Pencil className="w-3.5 h-3.5 text-slate-300 mx-1" />
                    <ChevronDown className={cn('w-4 h-4 text-slate-300 transition-transform', isExpanded && 'rotate-180')} />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && draft && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden border-t border-slate-100"
                    >
                      <div className="p-5 space-y-5 bg-slate-50/40">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Access Level</label>
                            <select
                              value={draft.type}
                              onChange={e => setDraft(d => d && ({ ...d, type: e.target.value }))}
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all outline-none text-sm font-medium text-slate-700"
                            >
                              {USER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Reset Password (optional)</label>
                            <input
                              type="text"
                              value={draft.password}
                              onChange={e => setDraft(d => d && ({ ...d, password: e.target.value }))}
                              placeholder="Leave blank to keep current password"
                              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                            />
                          </div>
                        </div>

                        {draft.type !== 'Admin' && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">Department Access</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {permissionColumns.map(col => (
                                <label key={col} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 cursor-pointer hover:border-brand-300">
                                  <input
                                    type="checkbox"
                                    checked={draft.permissions.has(col)}
                                    onChange={() => togglePermission(draft.permissions, col, s => setDraft(d => d && ({ ...d, permissions: s })))}
                                    className="accent-brand-500 w-3.5 h-3.5"
                                  />
                                  {col}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setExpanded(null); setDraft(null); }}
                            className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(user.username)}
                            disabled={busyKey === user.username}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-600 disabled:opacity-50 transition-all"
                          >
                            {busyKey === user.username ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Save
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
