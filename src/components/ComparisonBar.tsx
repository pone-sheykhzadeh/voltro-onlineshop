import React, { useState } from 'react';
import { useComparison } from '../context/ComparisonContext.tsx';

interface ComparisonBarProps {
  onNavigate: (route: string) => void;
}

export const ComparisonBar: React.FC<ComparisonBarProps> = ({ onNavigate }) => {
  const { comparisonProducts, removeFromComparison, clearComparison, count } = useComparison();
  const [isMinimized, setIsMinimized] = useState(false);

  if (count === 0) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-0 left-0 right-0 z-40 px-3 sm:px-6 pb-3 pt-2 transition-transform duration-300 pointer-events-none"
    >
      <div className="max-w-6xl mx-auto pointer-events-auto">
        <div className="bg-white/95 dark:bg-[#141417]/95 backdrop-blur-md border border-slate-200 dark:border-amber-500/30 shadow-2xl rounded-2xl p-3 sm:p-4 text-slate-900 dark:text-white">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-amber-500 animate-pulse"></span>
              <h4 className="text-sm sm:text-base font-bold text-blue-600 dark:text-amber-400">
                مقایسه هوشمند محصولات ({count} از ۴ کالا)
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearComparison}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-rose-500 transition-colors px-2 py-1 rounded cursor-pointer"
              >
                پاک کردن همه
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title={isMinimized ? 'باز کردن' : 'کوچک کردن'}
              >
                {isMinimized ? '▲ نمایش' : '▼ بستن'}
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              {/* Product thumbnails list */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {comparisonProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 rounded-xl p-1.5 sm:p-2 pr-2.5 relative group min-w-[130px] sm:min-w-[160px] max-w-[200px]"
                  >
                    <img
                      src={prod.image || prod.images[0]}
                      alt={prod.name}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 object-contain rounded-lg bg-white dark:bg-zinc-900 p-0.5 shrink-0 border border-slate-200 dark:border-white/[0.04]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-900 dark:text-zinc-200 truncate">{prod.name}</p>
                      <p className="text-[11px] text-blue-600 dark:text-amber-400 font-bold truncate">
                        {prod.basePrice.toLocaleString('fa-IR')} تومان
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromComparison(prod.id)}
                      className="text-slate-400 dark:text-zinc-400 hover:text-rose-500 p-1 rounded-full transition-colors shrink-0 cursor-pointer"
                      title="حذف از مقایسه"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Empty slots placeholders */}
                {Array.from({ length: 4 - count }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="hidden md:flex items-center justify-center border border-dashed border-slate-300 dark:border-zinc-700/50 rounded-xl px-3 py-2 text-slate-400 dark:text-zinc-500 text-xs min-w-[120px] h-[52px]"
                  >
                    + جایگاه خالی
                  </div>
                ))}
              </div>

              {/* Action button */}
              <div className="w-full sm:w-auto flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={count < 2}
                  onClick={() => onNavigate('compare')}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
                    count >= 2
                      ? 'bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-amber-500 dark:to-amber-600 dark:hover:from-amber-400 dark:hover:to-amber-500 text-white dark:text-zinc-950 shadow-blue-500/20 dark:shadow-amber-500/20 active:scale-95 cursor-pointer'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed border border-slate-300 dark:border-zinc-700/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <span>مقایسه رو در رو ({count})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
