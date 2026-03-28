import React, { useState } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface Props {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/proxy?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        onLogin(data);
      }
    } catch (err) {
      setError('Connection failed. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Soft Background Accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-slate-50 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden transition-all duration-500">
          {/* Header */}
          <div className="px-10 pt-12 pb-6 text-center">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-slate-100 overflow-hidden"
            >
              <img
                src="https://lh3.googleusercontent.com/d/1JIgrmv3JkmGICyFT2vsi38n3hLW6H92Y"
                alt="Logo"
                className="w-full h-full object-cover scale-110"
              />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Refrasynth</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5 leading-none"></p>
          </div>

          <form onSubmit={handleSubmit} className="px-10 py-6 space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-50 transition-all outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-50 transition-all outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 flex items-center justify-center bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 transition-all shadow-lg shadow-slate-200 mt-2"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Verifying...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Login</span>
                </div>
              )}
            </button>
          </form>

          <div className="px-10 pb-10">
            <div className="flex items-center justify-center pt-6 border-t border-slate-50 gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none">Secure Access Only</span>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          © 2026 Refrasynth Solutions
        </p>
      </div>
    </div>
  );
}
