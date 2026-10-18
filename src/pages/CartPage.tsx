import React, { useState } from 'react';
import { useCart } from '../context/CartContext.tsx';
import { CheckoutModal } from '../components/CheckoutModal.tsx';
import { formatPrice } from '../utils/format.ts';
import type { Order } from '../types/index.ts';

interface CartPageProps {
  onNavigate: (path: string, orderId?: string) => void;
}

export const CartPage: React.FC<CartPageProps> = ({ onNavigate }) => {
  const { items, updateQuantity, removeFromCart, itemCount, subtotal, totalAmount } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const handleOrderSuccess = (order: Order) => {
    onNavigate('account');
  };

  return (
    <div className="w-full min-h-screen pt-20 transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        {/* Breadcrumb & Minimal Title */}
        <section className="w-full pb-8">
          <div className="flex flex-col gap-2 text-right">
            <nav className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-500 font-mono text-xs">
              <button onClick={() => onNavigate('home')} className="hover:text-blue-500 transition-colors cursor-pointer">
                خانه
              </button>
              <span className="material-symbols-outlined text-xs">chevron_left</span>
              <span className="text-slate-700 dark:text-zinc-300 font-medium">سبد خرید</span>
            </nav>
            <div className="flex items-baseline justify-between mt-2">
              <h1 className="font-headline-lg text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                سبد خرید
              </h1>
              <span className="text-xs font-mono text-slate-500 dark:text-zinc-500">
                {itemCount} کالا
              </span>
            </div>
          </div>
        </section>

        {/* Main Cart & Summary Layout */}
        {items.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center rounded-3xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] p-8 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mb-4">
              <span className="material-symbols-outlined text-3xl">shopping_bag</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              سبد خرید شما خالی است
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mb-6 leading-relaxed">
              گجت‌ها و پرچمداران دیجیتال مد نظرتان را از ویترین فروشگاه انتخاب و اضافه نمایید.
            </p>
            <button
              onClick={() => onNavigate('products')}
              className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] cursor-pointer"
            >
              مشاهده ویترین محصولات
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left in RTL: Minimal Item List (8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col divide-y transition-colors divide-slate-200 dark:divide-zinc-800/80 border-t border-b border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-[#121214] rounded-2xl px-6 border shadow-sm">
              {items.map((item) => (
                <div key={item.id} className="py-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-5">
                    {/* Clean cutout thumbnail */}
                    <div
                      onClick={() => onNavigate('product-details', item.productId)}
                      className="cursor-pointer w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl border flex items-center justify-center p-2 bg-slate-50 dark:bg-[#121214] border-slate-200 dark:border-zinc-800/80"
                    >
                      <img
                        src={item.variant.image || item.product.images[0]}
                        alt={item.product.name}
                        className="product-cutout w-full h-full object-contain filter contrast-105"
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <h3
                        onClick={() => onNavigate('product-details', item.productId)}
                        className="cursor-pointer font-headline-sm text-sm sm:text-base font-semibold text-slate-900 dark:text-white hover:text-blue-500 transition-colors"
                      >
                        {item.product.name}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-zinc-500">
                        {item.variant.colorName} • {item.variant.storage}
                      </span>
                      <div className="mt-2 text-sm font-mono font-bold text-slate-900 dark:text-zinc-200">
                        {formatPrice(item.variant.price)}{' '}
                        <span className="text-xs text-slate-500 font-normal">تومان</span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Controls + Trash */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-lg px-1 py-0.5 border bg-slate-50 dark:bg-[#121214] border-slate-200 dark:border-zinc-800 shadow-xs">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="افزایش تعداد"
                        className="w-7 h-7 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                      <span className="w-7 text-center font-mono text-xs text-slate-800 dark:text-zinc-200 font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label="کاهش تعداد"
                        className="w-7 h-7 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">remove</span>
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      aria-label="حذف کالا"
                      className="text-slate-400 dark:text-zinc-500 hover:text-rose-500 p-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Right in RTL: Minimal Order Summary Card (4 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-28 text-right">
              <div className="border rounded-2xl p-6 flex flex-col gap-6 shadow-md transition-colors bg-white dark:bg-[#121214] border-slate-200 dark:border-zinc-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  خلاصه سفارش
                </h2>

                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                    <span>مجموع اقلام</span>
                    <span className="font-mono text-slate-900 dark:text-zinc-200 font-semibold">
                      {formatPrice(subtotal)} تومان
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                    <span>ارسال اکسپرس اختصاصی</span>
                    <span className="text-blue-600 dark:text-blue-500 font-semibold">رایگان</span>
                  </div>
                </div>

                <div className="border-t pt-4 flex items-baseline justify-between border-slate-200 dark:border-zinc-800">
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    مبلغ کل
                  </span>
                  <div className="text-left">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {formatPrice(totalAmount)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 mr-1 font-normal">تومان</span>
                  </div>
                </div>

                {/* Checkout CTA */}
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
                >
                  <span>تکمیل سفارش و پرداخت آنلاین</span>
                  <span className="material-symbols-outlined text-base">arrow_left_alt</span>
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-zinc-500 pt-1">
                  <span className="material-symbols-outlined text-sm text-slate-400 dark:text-zinc-500">lock</span>
                  <span>پرداخت مستقیم، امن و رمزنگاری‌شده شاپرک</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleOrderSuccess}
      />
    </div>
  );
};
