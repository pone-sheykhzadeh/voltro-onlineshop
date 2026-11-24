import React, { useState, useMemo } from 'react';
import { useComparison } from '../context/ComparisonContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import type { Product } from '../types/index.ts';

interface ComparisonPageProps {
  onNavigate: (route: string, productId?: string) => void;
}

interface SpecRowDefinition {
  id: string;
  label: string;
  category: 'overview' | 'performance' | 'display' | 'camera' | 'battery' | 'system';
  getValue: (p: Product) => string;
  isBest?: (p: Product, all: Product[]) => boolean;
}

export const ComparisonPage: React.FC<ComparisonPageProps> = ({ onNavigate }) => {
  const { comparisonProducts, removeFromComparison, addToComparison, clearComparison, allProducts } = useComparison();
  const { addToCart } = useCart();
  const [onlyDifferences, setOnlyDifferences] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Spec row definitions covering the 15 requested technical specifications
  const specRows: SpecRowDefinition[] = useMemo(
    () => [
      {
        id: 'brand',
        label: 'برند و مدل',
        category: 'overview',
        getValue: (p) => `${p.brand} - ${p.name}`,
      },
      {
        id: 'price',
        label: 'قیمت پایه (تومان)',
        category: 'overview',
        getValue: (p) => `${p.basePrice.toLocaleString('fa-IR')} تومان`,
        isBest: (p, all) => {
          const minPrice = Math.min(...all.map((item) => item.basePrice));
          return p.basePrice === minPrice && all.length > 1;
        },
      },
      {
        id: 'chipset',
        label: 'پردازنده و تراشه',
        category: 'performance',
        getValue: (p) => p.specifications?.chipset || p.specifications?.processor || '—',
      },
      {
        id: 'ram',
        label: 'حافظه رم (RAM)',
        category: 'performance',
        getValue: (p) => p.specifications?.ram || '—',
        isBest: (p, all) => {
          const extractGb = (str?: string) => {
            const m = str?.match(/(\d+)\s*(?:GB|گیگابایت)/i);
            return m ? parseInt(m[1], 10) : 0;
          };
          const pVal = extractGb(p.specifications?.ram);
          const maxVal = Math.max(...all.map((item) => extractGb(item.specifications?.ram)));
          return pVal > 0 && pVal === maxVal && all.length > 1;
        },
      },
      {
        id: 'storage',
        label: 'حافظه داخلی (Storage)',
        category: 'performance',
        getValue: (p) => p.specifications?.storage || '—',
      },
      {
        id: 'displaySize',
        label: 'اندازه نمایشگر',
        category: 'display',
        getValue: (p) => p.specifications?.displaySize || p.specifications?.display || '—',
      },
      {
        id: 'displayTech',
        label: 'فناوری صفحه نمایش',
        category: 'display',
        getValue: (p) => p.specifications?.displayTech || '—',
      },
      {
        id: 'refreshRate',
        label: 'رزولوشن و نرخ نوسازی',
        category: 'display',
        getValue: (p) => {
          const res = p.specifications?.resolution || '';
          const rate = p.specifications?.refreshRate || '';
          if (res && rate) return `${res} | ${rate}`;
          return res || rate || '—';
        },
        isBest: (p, all) => {
          const extractHz = (str?: string) => {
            const m = str?.match(/(\d+)\s*Hz/i);
            return m ? parseInt(m[1], 10) : 0;
          };
          const pVal = extractHz(p.specifications?.refreshRate);
          const maxVal = Math.max(...all.map((item) => extractHz(item.specifications?.refreshRate)));
          return pVal > 60 && pVal === maxVal && all.length > 1;
        },
      },
      {
        id: 'mainCamera',
        label: 'دوربین اصلی',
        category: 'camera',
        getValue: (p) => p.specifications?.mainCamera || p.specifications?.camera || '—',
        isBest: (p, all) => {
          const extractMp = (str?: string) => {
            const m = str?.match(/(\d+)\s*مگاپیکسل/i);
            return m ? parseInt(m[1], 10) : 0;
          };
          const pVal = extractMp(p.specifications?.mainCamera || p.specifications?.camera);
          const maxVal = Math.max(
            ...all.map((item) => extractMp(item.specifications?.mainCamera || item.specifications?.camera))
          );
          return pVal > 0 && pVal === maxVal && all.length > 1;
        },
      },
      {
        id: 'frontCamera',
        label: 'دوربین سلفی',
        category: 'camera',
        getValue: (p) => p.specifications?.frontCamera || '—',
      },
      {
        id: 'batteryCapacity',
        label: 'ظرفیت باتری',
        category: 'battery',
        getValue: (p) => p.specifications?.batteryCapacity || p.specifications?.battery || '—',
        isBest: (p, all) => {
          const extractMah = (str?: string) => {
            const m = str?.match(/(\d+)\s*(?:میلی|mAh)/i);
            return m ? parseInt(m[1], 10) : 0;
          };
          const pVal = extractMah(p.specifications?.batteryCapacity || p.specifications?.battery);
          const maxVal = Math.max(
            ...all.map((item) => extractMah(item.specifications?.batteryCapacity || item.specifications?.battery))
          );
          return pVal > 0 && pVal === maxVal && all.length > 1;
        },
      },
      {
        id: 'chargingSpeed',
        label: 'سرعت شارژ',
        category: 'battery',
        getValue: (p) => p.specifications?.chargingSpeed || '—',
        isBest: (p, all) => {
          const extractW = (str?: string) => {
            const m = str?.match(/(\d+)\s*وات/i);
            return m ? parseInt(m[1], 10) : 0;
          };
          const pVal = extractW(p.specifications?.chargingSpeed);
          const maxVal = Math.max(...all.map((item) => extractW(item.specifications?.chargingSpeed)));
          return pVal > 0 && pVal === maxVal && all.length > 1;
        },
      },
      {
        id: 'os',
        label: 'سیستم‌عامل و رابط',
        category: 'system',
        getValue: (p) => p.specifications?.os || '—',
      },
      {
        id: 'connectivity',
        label: 'اتصالات و شبکه',
        category: 'system',
        getValue: (p) => p.specifications?.connectivity || '5G, Wi-Fi 6, Bluetooth',
      },
      {
        id: 'rating',
        label: 'امتیاز کاربران',
        category: 'overview',
        getValue: (p) => `★ ${p.rating.toFixed(1)} (${p.reviewCount} نظر)`,
        isBest: (p, all) => {
          const maxRate = Math.max(...all.map((item) => item.rating));
          return p.rating === maxRate && all.length > 1;
        },
      },
    ],
    []
  );

  // Filter rows based on onlyDifferences toggle
  const visibleRows = useMemo(() => {
    if (!onlyDifferences || comparisonProducts.length < 2) {
      return specRows;
    }
    return specRows.filter((row) => {
      const values = comparisonProducts.map((p) => row.getValue(p).trim());
      // Check if not all values are identical
      const first = values[0];
      return values.some((v) => v !== first);
    });
  }, [onlyDifferences, comparisonProducts, specRows]);

  // Candidates for adding to comparison
  const availableCandidates = useMemo(() => {
    const existingIds = new Set(comparisonProducts.map((p) => p.id));
    return allProducts
      .filter((p) => !existingIds.has(p.id))
      .filter((p) =>
        searchTerm ? p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.brand.toLowerCase().includes(searchTerm.toLowerCase()) : true
      );
  }, [allProducts, comparisonProducts, searchTerm]);

  // If fewer than 2 products
  if (comparisonProducts.length < 2) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100 pt-28 pb-16 px-4 sm:px-6 transition-colors duration-200">
        <div className="max-w-4xl mx-auto text-center py-16 bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/[0.06] rounded-3xl p-8 shadow-xl">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 mb-3">
            برای مقایسه تخصصی، حداقل ۲ محصول انتخاب کنید
          </h2>
          <p className="text-slate-600 dark:text-zinc-400 text-sm sm:text-base max-w-lg mx-auto mb-8">
            در ولترو می‌توانید تا ۴ محصول را در ۱۵ شاخصه فنی و عملکردی به صورت رو در رو و دقیق بررسی کنید.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              مشاهده محصولات و انتخاب
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer"
            >
              بازگشت به صفحه اصلی
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100 pb-24 pt-24 px-3 sm:px-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-1">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="hover:text-blue-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
              >
                خانه
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="hover:text-blue-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
              >
                محصولات
              </button>
              <span>/</span>
              <span className="text-blue-600 dark:text-amber-400 font-medium">مقایسه تخصصی</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              مقایسه رو در روی مشخصات فنی ({comparisonProducts.length} محصول)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Highlight differences toggle */}
            <label className="flex items-center gap-2 bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/[0.08] px-3.5 py-2 rounded-xl cursor-pointer hover:border-blue-500/50 transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={onlyDifferences}
                onChange={(e) => setOnlyDifferences(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300">فقط تفاوت‌ها</span>
            </label>

            {/* Clear comparison */}
            <button
              type="button"
              onClick={clearComparison}
              className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 hover:text-rose-500 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-rose-500/40 bg-white dark:bg-[#141417] transition-colors cursor-pointer"
            >
              پاک کردن همه
            </button>

            {/* Add product button if slots available */}
            {comparisonProducts.length < 4 && (
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                className="bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>+ افزودن کالا ({comparisonProducts.length}/۴)</span>
              </button>
            )}
          </div>
        </div>

        {/* Responsive Comparison Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#141417] shadow-xl">
          <table className="w-full border-collapse min-w-[700px]">
            {/* STICKY HEADER ROW */}
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#141417]/95 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.08]">
              <tr>
                <th className="p-4 text-right w-44 sm:w-56 bg-slate-100/80 dark:bg-[#18181c] text-xs font-bold text-slate-600 dark:text-zinc-400 border-l border-slate-200 dark:border-white/[0.06]">
                  مشخصات فنی و امکانات
                </th>
                {comparisonProducts.map((prod) => (
                  <th
                    key={prod.id}
                    className="p-4 text-center align-top relative border-l border-slate-200 dark:border-white/[0.06] last:border-l-0 min-w-[180px] sm:min-w-[220px]"
                  >
                    <div className="relative group flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => removeFromComparison(prod.id)}
                        className="absolute -top-1 -right-1 text-slate-400 dark:text-zinc-400 hover:text-rose-500 bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 p-1.5 rounded-full transition-colors cursor-pointer"
                        title="حذف از مقایسه"
                      >
                        ✕
                      </button>

                      <div
                        onClick={() => onNavigate('product-details', prod.id)}
                        className="cursor-pointer group-hover:scale-105 transition-transform"
                      >
                        <img
                          src={prod.image || prod.images[0]}
                          alt={prod.name}
                          loading="lazy"
                          decoding="async"
                          className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-xl bg-slate-50 dark:bg-[#0A0A0C] p-2 mb-2 border border-slate-200 dark:border-white/[0.06]"
                        />
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-amber-400 transition-colors line-clamp-2 mb-1">
                          {prod.name}
                        </p>
                      </div>

                      <div className="text-blue-600 dark:text-amber-400 font-extrabold text-sm sm:text-base my-1">
                        {prod.basePrice.toLocaleString('fa-IR')} تومان
                      </div>

                      <div className="flex items-center gap-2 mt-2 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            const variant = prod.variants[0];
                            if (variant) addToCart(prod, variant, 1);
                          }}
                          className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          خرید سریع
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('product-details', prod.id)}
                          className="py-1.5 px-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          جزئیات
                        </button>
                      </div>
                    </div>
                  </th>
                ))}

                {/* Empty slot column if less than 4 products */}
                {comparisonProducts.length < 4 && (
                  <th className="p-4 text-center align-middle border-l border-dashed border-slate-200 dark:border-white/[0.08] min-w-[160px] bg-slate-50/50 dark:bg-[#0A0A0C]/40">
                    <button
                      type="button"
                      onClick={() => setSearchModalOpen(true)}
                      className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-blue-500/60 rounded-2xl text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-amber-400 transition-all w-full cursor-pointer group"
                    >
                      <span className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 group-hover:bg-blue-500/20 flex items-center justify-center text-lg mb-2">
                        +
                      </span>
                      <span className="text-xs font-bold">افزودن محصول دیگر</span>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">حداکثر تا ۴ کالا</span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>

            {/* TABLE BODY ROWS */}
            <tbody>
              {visibleRows.map((row, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-200/70 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors ${
                      isEven ? 'bg-slate-50/50 dark:bg-white/[0.01]' : 'bg-transparent'
                    }`}
                  >
                    <td className="p-3 sm:p-4 font-semibold text-xs sm:text-sm text-slate-700 dark:text-zinc-300 bg-slate-100/60 dark:bg-[#18181c]/70 border-l border-slate-200 dark:border-white/[0.06]">
                      {row.label}
                    </td>

                    {comparisonProducts.map((prod) => {
                      const value = row.getValue(prod);
                      const isBest = row.isBest ? row.isBest(prod, comparisonProducts) : false;

                      return (
                        <td
                          key={`cell-${row.id}-${prod.id}`}
                          className={`p-3 sm:p-4 text-center text-xs sm:text-sm border-l border-slate-200 dark:border-white/[0.06] last:border-l-0 ${
                            isBest
                              ? 'bg-emerald-500/5 dark:bg-amber-500/5 font-bold text-emerald-700 dark:text-amber-300'
                              : 'text-slate-700 dark:text-zinc-200'
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span>{value}</span>
                            {isBest && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 dark:bg-amber-500/20 text-emerald-700 dark:text-amber-400 border border-emerald-500/30 dark:border-amber-500/30 px-2 py-0.5 rounded-full">
                                ★ برترین در مقایسه
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {comparisonProducts.length < 4 && (
                      <td className="p-3 sm:p-4 text-center text-slate-400 dark:text-zinc-600 bg-slate-50/30 dark:bg-[#0A0A0C]/20 border-l border-dashed border-slate-200 dark:border-white/[0.06]">
                        —
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TO ADD MORE PRODUCTS */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#141417] border border-slate-200 dark:border-white/[0.08] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <span className="text-blue-600 dark:text-amber-400">⊕</span>
                افزودن محصول به لیست مقایسه
              </h3>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-[#0A0A0C]/50">
              <input
                type="text"
                placeholder="جستجوی نام گوشی، مدل یا برند..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-[#18181c] border border-slate-300 dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {availableCandidates.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-zinc-500 text-sm">
                  محصولی برای افزودن به مقایسه یافت نشد.
                </div>
              ) : (
                availableCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#18181c] hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/[0.06] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={cand.image || cand.images[0]}
                        alt={cand.name}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 object-contain rounded-lg bg-white dark:bg-[#0A0A0C] p-1 shrink-0 border border-slate-200 dark:border-white/[0.04]"
                      />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-zinc-200 truncate">{cand.name}</p>
                        <p className="text-xs text-blue-600 dark:text-amber-400 font-bold">
                          {cand.basePrice.toLocaleString('fa-IR')} تومان
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        addToComparison(cand);
                        setSearchModalOpen(false);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shrink-0 transition-colors cursor-pointer"
                    >
                      + افزودن
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
