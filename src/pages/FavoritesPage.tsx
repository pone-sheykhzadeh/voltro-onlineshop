import React from 'react';
import { useFavorites } from '../context/FavoritesContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { formatPrice } from '../utils/format.ts';
import type { Product } from '../types/index.ts';

interface FavoritesPageProps {
  onNavigate: (path: string, id?: string) => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({ onNavigate }) => {
  const { favorites, isLoading, removeFavorite } = useFavorites();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const handleAddAllToCart = () => {
    if (favorites.length === 0) return;
    let addedCount = 0;
    favorites.forEach((p) => {
      const v = p.variants[0];
      if (v && v.stock > 0) {
        addToCart(p, v, 1);
        addedCount++;
      }
    });
    if (addedCount > 0) {
      showToast(`${addedCount} قلم کالای موجود به سبد خرید منتقل شد.`, 'success');
    } else {
      showToast('کالاهای موجود در انبار به سبد خرید اضافه شدند.', 'info');
    }
  };

  return (
    <div className="w-full min-h-screen pt-20 transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 text-right">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-zinc-400 mb-6">
          <button
            onClick={() => onNavigate('home')}
            className="hover:text-blue-500 transition-colors cursor-pointer"
          >
            صفحه اصلی
          </button>
          <span className="text-slate-300 dark:text-zinc-600">/</span>
          <span className="text-slate-900 dark:text-white font-medium">علاقه‌مندی‌ها</span>
        </div>

        {/* Page Header (Clean title without manager/admin controls) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200 dark:border-white/[0.06]">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                <span className="material-symbols-outlined text-2xl">favorite</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                علاقه‌مندی‌های من
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                {favorites.length} کالا
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
              کالاهای مورد علاقه و نشان‌شده شما برای دسترسی سریع‌تر و خرید هوشمند.
            </p>
          </div>

          {favorites.length > 0 && (
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                onClick={handleAddAllToCart}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
                <span>انتقال همه به سبد خرید</span>
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
              در حال بارگذاری لیست علاقه‌مندی‌ها...
            </span>
          </div>
        ) : favorites.length === 0 ? (
          /* Empty State matching Stitch styling */
          <div className="p-12 sm:p-16 rounded-3xl border text-center bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-sm max-w-xl mx-auto my-12">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-5 border border-rose-200 dark:border-rose-500/20">
              <span className="material-symbols-outlined text-3xl">favorite_border</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              لیست علاقه‌مندی‌های شما خالی است
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed max-w-md mx-auto">
              شما هنوز هیچ کالایی را به لیست علاقه‌مندی‌های خود اضافه نکرده‌اید. با کلیک روی آیکون قلب روی هر کالا، آن را ذخیره کنید تا در هر زمان به آن دسترسی داشته باشید.
            </p>
            <button
              onClick={() => onNavigate('products')}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">storefront</span>
              <span>مشاهده محصولات فروشگاه</span>
            </button>
          </div>
        ) : (
          /* Product Grid matching Stitch card design */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {favorites.map((product) => {
              const defaultVariant = product.variants[0];
              const isInStock = product.stockTotal > 0;

              return (
                <div
                  key={product.id}
                  className="group relative rounded-2xl border transition-all flex flex-col p-4 shadow-sm bg-white dark:bg-[#161619] hover:bg-slate-50/70 dark:hover:bg-[#1a1a1f] border-slate-200 dark:border-white/[0.06] hover:border-blue-500/40"
                >
                  {/* Top Bar inside Card: Tag & Heart Button */}
                  <div className="flex items-center justify-between mb-3 z-10">
                    <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold">
                      {product.brand}
                    </span>
                    <button
                      onClick={() => removeFavorite(product.id)}
                      title="حذف از علاقه‌مندی‌ها"
                      className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all flex items-center justify-center cursor-pointer shadow-xs border border-rose-200 dark:border-rose-500/20"
                    >
                      <span className="material-symbols-outlined text-base">favorite</span>
                    </button>
                  </div>

                  {/* Product Image */}
                  <div
                    onClick={() => onNavigate('product-details', product.id)}
                    className="cursor-pointer relative w-full h-44 rounded-xl flex items-center justify-center p-3 mb-4 overflow-hidden bg-slate-50 dark:bg-[#0A0A0C]"
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="product-cutout max-h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Info & Price */}
                  <div className="flex flex-col gap-1.5 text-right flex-1 justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          {product.category}
                        </span>
                        <div className="flex items-center gap-1 text-amber-500">
                          <span className="material-symbols-outlined text-xs">star</span>
                          <span className="font-mono text-xs text-slate-800 dark:text-white font-semibold">
                            {product.rating}
                          </span>
                        </div>
                      </div>

                      <h3
                        onClick={() => onNavigate('product-details', product.id)}
                        className="cursor-pointer text-xs font-semibold line-clamp-2 text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors leading-relaxed"
                      >
                        {product.name}
                      </h3>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-white/[0.04] mt-2">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">قیمت:</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-display text-base font-bold font-mono text-slate-900 dark:text-white">
                            {formatPrice(product.basePrice)}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400">تومان</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onNavigate('product-details', product.id)}
                          className="py-2 px-2 rounded-xl border text-center text-xs font-semibold transition-all bg-slate-100 dark:bg-[#1e1e24] hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-white/[0.06] cursor-pointer"
                        >
                          مشاهده کالا
                        </button>
                        <button
                          onClick={() => {
                            if (defaultVariant && isInStock) {
                              addToCart(product, defaultVariant, 1);
                            }
                          }}
                          disabled={!isInStock}
                          className={`py-2 px-2 rounded-xl text-center text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                            isInStock
                              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm'
                              : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">shopping_bag</span>
                          <span>{isInStock ? 'خرید' : 'ناموجود'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
