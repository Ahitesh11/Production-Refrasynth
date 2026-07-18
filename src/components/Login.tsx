import React, { useState } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon, Loader2, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onLogin: (user: User) => void;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-15%] right-[-10%] w-[55%] h-[55%] bg-brand-100/40 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[-15%] left-[-10%] w-[55%] h-[55%] bg-brand-200/30 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, 10, 0], y: [0, -10, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-brand-300/20 rounded-full blur-[140px]"
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px] relative z-10"
      >
        <motion.div
          variants={itemVariants}
          className="bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-200/80 shadow-2xl shadow-brand-100/30"
        >
          <div className="px-10 pt-12 pb-8 text-center">
            <motion.div
              variants={itemVariants}
              className="w-20 h-20 mx-auto mb-6"
            >
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </motion.div>
            <motion.h1 variants={itemVariants} className="text-2xl font-semibold tracking-tight text-brand-900">
              Refrasynth
            </motion.h1>
            <motion.p variants={itemVariants} className="text-sm text-slate-500 font-normal mt-1.5">
              Production Management System
            </motion.p>
          </div>

          <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-5">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="bg-rose-50/80 border border-rose-200 text-rose-700 px-4 py-3.5 rounded-xl text-sm font-medium flex items-center gap-3 overflow-hidden"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <motion.div variants={itemVariants} className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">
                  Username
                </label>
                <div className="relative group">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full h-12 pl-10 pr-4 bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                    placeholder="Enter your username"
                  />
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full h-12 pl-10 pr-12 bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-50 transition-all outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            </div>

            <motion.button
              variants={itemVariants}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full h-12 flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold tracking-wide disabled:opacity-50 transition-all shadow-lg shadow-brand-200/50 hover:shadow-brand-300/50 mt-2"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2.5">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-200" />
                  <span>Login...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Sign In</span>
                </div>
              )}
            </motion.button>
          </form>
        </motion.div>

        <motion.p variants={itemVariants} className="text-center mt-8 text-[11px] font-medium text-slate-400">
          © {new Date().getFullYear()}  Passary Refractories. All Rights Reserved.
        </motion.p>
      </motion.div>
    </div>
  );
}