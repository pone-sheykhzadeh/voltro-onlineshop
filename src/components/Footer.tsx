import React, { useState } from 'react';
import { useToast } from '../context/ToastContext.tsx';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const { showToast } = useToast();

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      showToast('لطفاً یک ایمیل معتبر وارد کنید.', 'error');
      return;
    }
    showToast('ایمیل شما با موفقیت در خبرنامه ویژه ولترو ثبت شد.', 'success');
    setNewsletterEmail('');
  };

  return (
    <footer className="w-full transition-colors duration-200 bg-slate-900 dark:bg-[#080809] border-t border-slate-800 dark:border-white/[0.06] text-slate-300 dark:text-zinc-300 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12">
          {/* Col 1: Brand Info */}
          <div className="flex flex-col gap-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-500">
                <span className="material-symbols-outlined text-lg">bolt</span>
              </div>
              <span className="font-display font-bold text-lg text-white tracking-wider">
                VOLTRO
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-zinc-400 leading-relaxed font-light">
              مرجع تخصصی تجهیزات پردازشی، استودیویی و گجت‌های فوق‌پیشرفته با استانداردهای مهندسی لوکس و گارانتی رسمی تعویض.
            </p>
          </div>

          {/* Col 2: Categories */}
          <div className="flex flex-col gap-2.5 text-right">
            <h5 className="text-sm font-semibold text-white mb-1">دسته‌بندی‌ها</h5>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              مک‌بوک و اولترابوک‌های M3
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              هدفون‌های های‌فای و استودیویی
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              ساعت‌های تیتانیومی سافایر
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              پرچمداران آیفون و گلکسی
            </button>
          </div>

          {/* Col 3: Quick Links */}
          <div className="flex flex-col gap-2.5 text-right">
            <h5 className="text-sm font-semibold text-white mb-1">دسترسی سریع</h5>
            <button
              onClick={() => onNavigate('home')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              ویترین فروشگاه
            </button>
            <button
              onClick={() => onNavigate('special-offers')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              پیشنهادات ویژه زمان‌دار
            </button>
            <button
              onClick={() => onNavigate('cart')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              پیگیری سفارش و سبد خرید
            </button>
            <button
              onClick={() => onNavigate('admin-dashboard')}
              className="text-xs text-slate-400 dark:text-zinc-400 hover:text-blue-400 transition-colors text-right"
            >
              پنل مدیریت و پایش انبار
            </button>
          </div>

          {/* Col 4: Newsletter */}
          <div className="flex flex-col gap-3 text-right">
            <h5 className="text-sm font-semibold text-white mb-1">خبرنامه</h5>
            <p className="text-xs text-slate-400 dark:text-zinc-400 leading-relaxed font-light">
              اطلاع از رونمایی محصولات جدید و نسخه‌های محدود.
            </p>
            <form onSubmit={handleNewsletter} className="flex items-center gap-2 mt-1">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="ایمیل شما..."
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-zinc-800/80 text-white placeholder:text-zinc-500 border border-white/[0.08] focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                aria-label="عضویت در خبرنامه"
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-[0_0_12px_rgba(37,99,235,0.4)] flex items-center justify-center shrink-0"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Metadata & SSL Bar */}
        <div className="pt-8 border-t border-slate-800 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
          <p>© 2025 تمامی حقوق متعلق به فروشگاه لوکس VOLTRO می‌باشد.</p>
          <div className="flex items-center gap-4">
            <span>IRAN / TEHRAN</span>
            <span className="text-blue-500 font-semibold">SECURE ENCRYPTED 256-BIT SSL</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
