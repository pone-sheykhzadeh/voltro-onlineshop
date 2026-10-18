import React, { useState, useRef, useEffect } from 'react';
import type { AIMessage } from '../types/index.ts';
import { useToast } from '../context/ToastContext.tsx';

interface AiChatPageProps {
  onNavigate: (path: string, productId?: string) => void;
}

export const AiChatPage: React.FC<AiChatPageProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: AIMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        text: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('voltro_auth_token') || ''}`,
        },
        body: JSON.stringify({
          message: text,
          history,
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        showToast(data.error || 'خطا در ارتباط با سرور.', 'error');
        return;
      }

      const assistantMessage: AIMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        recommendedProducts: data.recommendedProducts || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setIsLoading(false);
      showToast('خطا در برقراری ارتباط با دستیار هوشمند.', 'error');
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setInputValue('');
  };

  const starterCards = [
    {
      title: 'مقایسه آیفون 15 پرو و اس 24 اولترا',
      subtitle: 'بررسی تفاوت‌های کلیدی دوربین، باتری و تراشه',
      icon: 'compare_arrows',
    },
    {
      title: 'پیشنهاد لپ‌تاپ برنامه‌نویسی تا 70 میلیون',
      subtitle: 'بهترین مدل‌ها با حداقل 32 گیگابایت رم',
      icon: 'laptop_mac',
    },
    {
      title: 'بهترین هدفون نویز کنسلینگ برای موسیقی',
      subtitle: 'کیفیت صدای استودیویی با حذف نویز فعال',
      icon: 'headphones',
    },
    {
      title: 'بررسی ارزش خرید ساعت‌های هوشمند اپل',
      subtitle: 'مقایسه سری 9 با مدل اولترا 2',
      icon: 'watch',
    },
  ];

  const quickChips = [
    { label: 'مقایسه آیفون و سامسونگ', icon: 'auto_awesome' },
    { label: 'پیشنهاد گوشی تا 50 میلیون تومان', icon: 'payments' },
    { label: 'بهترین گوشی برای عکاسی', icon: 'photo_camera' },
    { label: 'ارزان‌ترین لپ‌تاپ برنامه‌نویسی', icon: 'terminal' },
  ];

  return (
    <div className="w-full min-h-screen transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100 flex flex-col justify-between">
      {/* Top Dedicated Assistant Bar */}
      <header className="fixed top-0 inset-x-0 z-50 transition-colors bg-white/90 dark:bg-[#0A0A0C]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] shadow-sm">
        <div className="h-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('home')} className="flex items-center gap-2 group">
              <span className="font-display text-lg tracking-widest font-bold text-blue-500">
                VOLTRO
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-400 font-mono font-semibold border border-blue-500/20">
                AI ASSIST
              </span>
            </button>
            <span className="hidden sm:inline-block w-px h-4 bg-zinc-800" />
            <button
              onClick={() => onNavigate('home')}
              className="hidden sm:flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_forward</span>
              <span>بازگشت به فروشگاه</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono transition-colors bg-slate-100 dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
              <span>مدل فعال: ولترو Core 4.8 (Gemini 3.8 Flash)</span>
            </div>

            <button
              onClick={handleResetChat}
              className="px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 bg-white dark:bg-[#141417] text-slate-700 dark:text-zinc-300 hover:text-blue-400 border-slate-200 dark:border-white/[0.06] shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span className="hidden sm:inline">گفتگوی جدید</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full pt-20 pb-40 flex-1 max-w-4xl mx-auto px-4 sm:px-6">
        {messages.length === 0 ? (
          /* Empty / Initial State */
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] text-center py-10">
            {/* Robot 3D Avatar */}
            <div className="relative flex items-center justify-center w-20 h-20 rounded-3xl border text-blue-500 mb-5 shadow-[0_0_30px_rgba(37,99,235,0.25)] bg-white dark:bg-[#18181c] border-slate-200 dark:border-white/[0.06]">
              <div className="absolute inset-0 rounded-3xl bg-blue-500/10 animate-pulse" />
              <span className="material-symbols-outlined text-4xl relative z-10 text-blue-500">
                smart_toy
              </span>
            </div>

            <div className="space-y-2 max-w-xl mx-auto mb-10">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                دستیار هوشمند خرید ولترو
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed font-light">
                مشاور هوشمند شما برای مقایسه قطعات، راهنمایی بودجه و انتخاب بهترین گجت‌های دیجیتال
              </p>
            </div>

            {/* 4 Starter Prompt Cards */}
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
              {starterCards.map((card, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(card.title)}
                  className="p-4 rounded-2xl border transition-all flex items-start gap-3.5 group text-right shadow-sm bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-[#18181d]"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 bg-blue-50 dark:bg-[#1e1e24] text-blue-400">
                    <span className="material-symbols-outlined text-lg">{card.icon}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-400 transition-colors">
                      {card.title}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5 leading-relaxed">
                      {card.subtitle}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation Stream */
          <div className="flex flex-col gap-6 py-8">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 text-right ${
                  msg.role === 'user' ? 'flex-row-reverse justify-start' : 'justify-start'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 dark:bg-[#18181c] text-blue-400 border border-blue-200 dark:border-white/[0.06]'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {msg.role === 'user' ? 'person' : 'smart_toy'}
                  </span>
                </div>

                {/* Message Bubble */}
                <div className="flex flex-col gap-2 max-w-2xl">
                  <div
                    className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line border shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none'
                        : 'bg-white dark:bg-[#141417] text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-white/[0.06] rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Render Recommended Product Cards inside assistant response */}
                  {msg.recommendedProducts && msg.recommendedProducts.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                      {msg.recommendedProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => onNavigate('product-details', p.id)}
                          className="cursor-pointer p-3 rounded-xl border flex items-center gap-3 transition-all hover:border-blue-500/50 bg-slate-50 dark:bg-[#161619] border-slate-200 dark:border-white/[0.06]"
                        >
                          <img
                            src={p.image}
                            alt={p.name}
                            className="product-cutout w-12 h-12 object-contain shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {p.name}
                            </span>
                            <span className="font-mono text-[11px] text-blue-400 font-bold">
                              {p.price.toLocaleString('en-US')} تومان
                            </span>
                            {p.reason && (
                              <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                                {p.reason}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] font-mono text-zinc-500 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 text-right">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                </div>
                <div className="p-4 rounded-2xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] text-xs text-zinc-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  <span>دستیار در حال بررسی کاتالوگ انبار و نگارش پاسخ است...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Sticky Bottom Dock Input Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 p-4 transition-colors bg-[#F8FAFC]/95 dark:bg-[#0B0B0C]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.06]">
        <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
          {/* Quick chips carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(chip.label)}
                className="px-3 py-1.5 rounded-full border text-xs transition-all flex items-center gap-1.5 shrink-0 bg-white dark:bg-[#141417] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.06] hover:border-blue-500/50 shadow-xs"
              >
                <span className="material-symbols-outlined text-sm text-blue-500">{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

          {/* Form input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-center gap-2 rounded-2xl p-2 border transition-all shadow-xl bg-white dark:bg-[#141417] border-slate-300 dark:border-white/[0.06] focus-within:border-blue-500"
          >
            <button
              type="button"
              title="پیوست تصویر کالا"
              onClick={() => showToast('پیوست فایل برای استعلام مدل در دسترس است.', 'info')}
              className="w-9 h-9 rounded-xl text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-lg">attachment</span>
            </button>
            <button
              type="button"
              title="ورودی صوتی"
              onClick={() => showToast('ورودی صوتی به زودی در دسترس خواهد بود.', 'info')}
              className="w-9 h-9 rounded-xl text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-lg">mic</span>
            </button>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="از دستیار هوشمند بپرسید... (مثال: بهترین هدفون با نویز کنسلینگ عالی تا 20 میلیون)"
              className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-zinc-500 text-xs sm:text-sm px-2 py-2 outline-none"
            />

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              aria-label="ارسال پیام"
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-40 transition-all"
            >
              <span className="material-symbols-outlined text-lg -rotate-90">send</span>
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono px-2">
            <span>تحلیل لحظه‌ای قیمت و مشخصات بر اساس موجودی انبار ولترو</span>
            <span>کلید میانبر: Enter جهت ارسال</span>
          </div>
        </div>
      </div>
    </div>
  );
};
