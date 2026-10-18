import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalTab, login, register, signInWithGoogle } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(authModalTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);
    const res = await signInWithGoogle();
    if (!res.success) {
      setIsLoading(false);
      if (
        res.error?.includes('Unsupported provider') ||
        res.error?.includes('provider is not enabled') ||
        res.error?.includes('validation_failed')
      ) {
        setErrorMessage(
          'ورود با گوگل هنوز در داشبورد Supabase فعال نشده است (نیازمند فعال‌سازی Google Provider در تب Authentication داشبورد).'
        );
      } else {
        setErrorMessage(res.error || 'خطا در برقراری ارتباط با سرویس ورود گوگل.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    if (tab === 'login') {
      const res = await login(email, password);
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'ورود ناموفق بود.');
      } else {
        showToast('ورود با موفقیت انجام شد.', 'success');
      }
    } else if (tab === 'register') {
      const res = await register(name, email, password, phone);
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.error || 'ثبت‌نام ناموفق بود.');
      } else {
        showToast('حساب کاربری شما با موفقیت ایجاد شد.', 'success');
      }
    } else if (tab === 'forgot') {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setIsLoading(false);
        showToast(data.message || 'لینک بازیابی ارسال شد.', 'info');
        setTab('login');
      } catch (err) {
        setIsLoading(false);
        setErrorMessage('خطا در ارسال درخواست بازیابی.');
      }
    }
  };

  const fillQuickDemo = (type: 'admin' | 'user') => {
    setTab('login');
    if (type === 'admin') {
      setEmail('admin@voltro.ir');
      setPassword('Admin@123456');
    } else {
      setEmail('user@voltro.ir');
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
            {tab === 'login'
              ? 'ورود به حساب کاربری'
              : tab === 'register'
              ? 'عضویت در خانواده ولترو'
              : 'بازیابی کلمه عبور'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {tab === 'login'
              ? 'به سامانه اختصاصی مشتریان و مدیریت خوش آمدید'
              : tab === 'register'
              ? 'ثبت اطلاعات جهت ثبت سفارش و پیگیری اختصاصی'
              : 'نشانی ایمیل حساب خود را وارد نمایید'}
          </p>
        </div>

        {/* Tab Switcher */}
        {tab !== 'forgot' && (
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
        )}

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
              نشانی ایمیل
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none text-left"
              dir="ltr"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                شماره موبایل (اختیاری)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09121234567"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#18181c] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.06] focus:border-blue-500 outline-none text-left"
                dir="ltr"
              />
            </div>
          )}

          {tab !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                  کلمه عبور
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setErrorMessage('');
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    رمز عبور را فراموش کرده‌اید؟
                  </button>
                )}
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
          )}

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
                  {tab === 'login'
                    ? 'ورود به حساب کاربری'
                    : tab === 'register'
                    ? 'ایجاد حساب کاربری'
                    : 'ارسال ایمیل بازیابی'}
                </span>
                <span className="material-symbols-outlined text-base">arrow_left_alt</span>
              </>
            )}
          </button>
        </form>

        {/* Google OAuth Login Button */}
        {tab !== 'forgot' && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="relative flex items-center justify-center my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-[#121215] px-3 text-slate-400 dark:text-zinc-500 text-[11px]">
                  یا
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-zinc-200 text-xs font-medium transition-all flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>ورود سریع با حساب کاربری گوگل</span>
            </button>
          </div>
        )}

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
