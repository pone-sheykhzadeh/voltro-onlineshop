import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalTab, login, register } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'login' | 'register'>(authModalTab);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setTab(authModalTab);
    setErrorMessage('');
  }, [authModalTab, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    if (tab === 'login') {
      const res = await login(username.trim(), password);
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'ورود ناموفق بود.');
      } else {
        showToast('ورود با موفقیت انجام شد.', 'success');
      }
    } else {
      if (!phone.trim() || !/^[0-9+\-\s]{10,15}$/.test(phone.trim())) {
        setIsLoading(false);
        setErrorMessage('لطفاً شماره موبایل معتبر وارد کنید.');
        return;
      }
      const res = await register(name.trim(), username.trim(), password, phone.trim());
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'ثبت‌نام ناموفق بود.');
      } else {
        showToast('حساب کاربری شما با موفقیت ایجاد شد.', 'success');
      }
    }
  };

  const fillQuickDemo = (type: 'admin' | 'user') => {
    setTab('login');
    if (type === 'admin') {
      setUsername('admin@voltro.ir');
      setPassword('Admin@123456');
    } else {
      setUsername('user@voltro.ir');
      setPassword('User@123456');
    }
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-3xl p-6 sm:p-8 border shadow-2xl transition-all bg-white dark:bg-[#121215] border-slate-200 dark:border-white/[0.06] text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute left-6 top-6 p-1.5 rounded-full text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 mb-3 shadow-[0_0_20px_rgba(37,99,235,0.25)]">
            <span className="material-symbols-outlined text-2xl">shield_person</span>
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {tab === 'login' ? 'ورود به حساب کاربری' : 'عضویت در خانواده ولترو'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {tab === 'login'
              ? 'ورود با نام کاربری و کلمه عبور اختصاصی'
              : 'ثبت مشخصات و شماره تماس جهت پیگیری سفارش‌ها'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-[#18181c] p-1 rounded-xl border border-slate-200 dark:border-white/[0.06] mb-6">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'login'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ورود
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'register'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ثبت‌نام جدید
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {tab === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                نام و نام خانوادگی
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: آرین تهرانی"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              نام کاربری
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="نام کاربری خود را وارد کنید"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none text-left"
              dir="ltr"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                شماره موبایل (جهت ثبت اطلاعات و پیگیری سفارش)
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09121234567"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none text-left"
                dir="ltr"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                کلمه عبور
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none text-left"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-base">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>
                  {tab === 'login' ? 'ورود به حساب کاربری' : 'ایجاد حساب کاربری'}
                </span>
                <span className="material-symbols-outlined text-base">arrow_left_alt</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Login Pills */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/[0.06] flex flex-col gap-2">
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 text-center">
            ورود سریع به حساب‌های آزمایشی:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillQuickDemo('admin')}
              className="px-3 py-2 rounded-xl text-[11px] font-medium bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">shield</span>
              <span>ورود مدیر ارشد</span>
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo('user')}
              className="px-3 py-2 rounded-xl text-[11px] font-medium bg-slate-100 dark:bg-zinc-800/40 hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.06] transition-all flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">person</span>
              <span>ورود خریدار دمو</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
