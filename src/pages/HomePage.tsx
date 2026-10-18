import React, { useEffect, useState } from 'react';
import type { Product, FlashCampaign } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useFavorites } from '../context/FavoritesContext.tsx';
import { formatPrice } from '../utils/format.ts';

interface HomePageProps {
  onNavigate: (path: string, productId?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [campaign, setCampaign] = useState<FlashCampaign | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [timeLeft, setTimeLeft] = useState<{ days: string; hours: string; minutes: string; seconds: string }>({
    days: '01',
    hours: '18',
    minutes: '42',
    seconds: '25',
  });

  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    // Load products from DB
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.products) setProducts(data.products);
      })
      .catch((err) => console.error('Failed to fetch products:', err));

    // Load active campaign from DB
    fetch('/api/campaigns/active')
      .then((res) => res.json())
      .then((data) => {
        if (data.campaign) {
          setCampaign(data.campaign);
        }
      })
      .catch((err) => console.error('Failed to fetch active campaign:', err));
  }, []);

  // Persistent live countdown timer linked to real DB campaign expiration
  useEffect(() => {
    const pad2 = (num: number) => String(num).padStart(2, '0');

    const targetDate = campaign?.endDate ? new Date(campaign.endDate).getTime() : Date.now() + 48 * 3600 * 1000;

    const timer = setInterval(() => {
      const now = Date.now();
      const distance = targetDate - now;

      if (distance <= 0) {
        setTimeLeft({ days: '00', hours: '00', minutes: '00', seconds: '00' });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({
        days: pad2(days),
        hours: pad2(hours),
        minutes: pad2(minutes),
        seconds: pad2(seconds),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [campaign]);

  // Flash deals products
  const flashProducts = products.filter((p) => p.isFlashDeal || (campaign && campaign.eligibleProductIds.includes(p.id)));

  // Filtered catalog products
  const filteredCatalog = products.filter((p) => {
    if (activeCategoryFilter === 'all') return true;
    return p.category === activeCategoryFilter;
  });

  const heroProduct = products.find((p) => p.id === 'prod-airpods-max') || products[1];
  const ultraWatch = products.find((p) => p.id === 'prod-apple-watch-ultra-2') || products[2];

  return (
    <div className="w-full min-h-screen pt-20 transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100">
      {/* 1. HERO SPOTLIGHT */}
      <section className="relative w-full px-4 sm:px-6 lg:px-10 pt-10 sm:pt-16 pb-20 overflow-hidden bg-gradient-to-b from-transparent via-transparent to-blue-50/40 dark:to-blue-950/10">
        {/* Ambient Halo Glow */}
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[540px] h-[540px] rounded-full blur-[140px] pointer-events-none bg-blue-400/15 dark:bg-blue-600/10" />
        <div className="absolute top-20 right-10 w-[380px] h-[380px] rounded-full blur-[120px] pointer-events-none bg-blue-300/15 dark:bg-blue-500/10" />

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Right side in RTL: Minimal Headline & CTAs */}
          <div className="lg:col-span-6 flex flex-col gap-6 text-right order-2 lg:order-1">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border w-fit bg-blue-50 dark:bg-[#141417] border-blue-200 dark:border-blue-500/20 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                نسل جدید آکوستیک فضایی
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-zinc-400 font-mono">
                AirPods Max Edition
              </span>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
                شکوهِ صدا در{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-400 via-blue-500 to-indigo-400">
                  کمال خالص
                </span>
              </h1>
            </div>

            <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-lg leading-relaxed font-light">
              شاهکار مهندسی آکوستیک با درایور سفارشی تیتانیومی، عایق فعال نویز و بدنه تمام آلومینیومی.
            </p>

            {/* Price Callout */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-xs text-slate-500 dark:text-zinc-400">قیمت ویژه:</span>
              <span className="font-display text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                42,850,000
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">تومان</span>
              <span className="text-xs text-zinc-500 line-through mr-2">58,000,000</span>
            </div>

            {/* Clean CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => {
                  if (heroProduct) {
                    addToCart(heroProduct, heroProduct.variants[0]);
                    onNavigate('cart');
                  }
                }}
                className="px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-[0_0_30px_rgba(37,99,235,0.45)] hover:scale-[1.02] transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">shopping_cart</span>
                <span>خرید مستقیم</span>
              </button>
              <button
                onClick={() => onNavigate('product-details', 'prod-airpods-max')}
                className="px-7 py-3.5 rounded-full border text-xs sm:text-sm font-medium transition-all flex items-center gap-2 bg-white dark:bg-[#18181c] text-slate-700 dark:text-zinc-200 border-slate-300 dark:border-white/[0.08] hover:border-blue-500 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg text-blue-400">tune</span>
                <span>مشاهده کالا</span>
              </button>
            </div>

            {/* 3 Minimal Micro Specs */}
            <div className="grid grid-cols-3 gap-3 pt-4 max-w-md">
              <div className="p-3.5 rounded-2xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-xs">
                <div className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                  40mm
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  درایور نئودیمیوم
                </div>
              </div>
              <div className="p-3.5 rounded-2xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-xs">
                <div className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                  20 ساعت
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  شارژ با ANC
                </div>
              </div>
              <div className="p-3.5 rounded-2xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-xs">
                <div className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Spatial
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  ردیابی سه‌بعدی
                </div>
              </div>
            </div>
          </div>

          {/* Left side in RTL: Isolated Product Cutout Render */}
          <div className="lg:col-span-6 relative flex items-center justify-center order-1 lg:order-2">
            <div className="absolute w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] rounded-full blur-3xl pointer-events-none bg-blue-300/30 dark:bg-blue-500/20" />
            <div className="absolute w-72 h-72 rounded-full border border-blue-500/20 animate-pulse" />

            <div className="relative z-10 w-full max-w-[380px] lg:max-w-[430px] flex items-center justify-center">
              <img
                src="/images/products/airpods-max.png"
                alt="AirPods Max"
                className="product-cutout w-full h-auto object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.8)] hover:scale-105 transition-transform duration-700 select-none"
              />
            </div>

            {/* Floating Official Trust Badge */}
            <div className="absolute -bottom-4 left-4 z-20 px-4 py-2.5 rounded-2xl backdrop-blur-xl border shadow-xl flex items-center gap-3 bg-white/95 dark:bg-[#141417]/95 border-slate-200 dark:border-white/[0.08]">
              <span className="material-symbols-outlined text-blue-500 text-xl">verified</span>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                  گارانتی 18 ماهه
                </span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  اصالت رسمی VOLTRO
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CURATED COLLECTIONS (4 MINIMAL TILES) */}
      <section className="w-full px-4 sm:px-6 lg:px-10 py-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-500 font-semibold tracking-widest uppercase">
                مجموعه برگزیده
              </span>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                دسته‌بندی‌ها
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-zinc-400 hidden sm:inline">
              4 دسته‌بندی انحصاری
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tile 1: Audio */}
            <div
              onClick={() => {
                setActiveCategoryFilter('audio');
                onNavigate('products');
              }}
              className="group cursor-pointer p-6 rounded-2xl border transition-all flex flex-col justify-between h-[310px] bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#1c1c21] border-slate-200 dark:border-white/[0.05] hover:border-blue-500/50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                  24 مدل
                </span>
                <span className="material-symbols-outlined text-slate-400 dark:text-zinc-400 group-hover:text-blue-500 group-hover:-translate-x-1 transition-all text-lg">
                  arrow_back
                </span>
              </div>
              <div className="my-auto flex items-center justify-center h-36">
                <img
                  src="/images/products/airpods-max.png"
                  alt="هدفون و صوتی"
                  className="product-cutout max-h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div>
                <h3 className="font-medium text-base text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  هدفون و صوتی
                </h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400">های‌فای و استودیویی</span>
              </div>
            </div>

            {/* Tile 2: Smartwatches */}
            <div
              onClick={() => {
                setActiveCategoryFilter('watches');
                onNavigate('products');
              }}
              className="group cursor-pointer p-6 rounded-2xl border transition-all flex flex-col justify-between h-[310px] bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#1c1c21] border-slate-200 dark:border-white/[0.05] hover:border-blue-500/50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                  18 مدل
                </span>
                <span className="material-symbols-outlined text-slate-400 dark:text-zinc-400 group-hover:text-blue-500 group-hover:-translate-x-1 transition-all text-lg">
                  arrow_back
                </span>
              </div>
              <div className="my-auto flex items-center justify-center h-36">
                <img
                  src="/images/products/apple-watch-ultra-2.png"
                  alt="ساعت‌های هوشمند"
                  className="product-cutout max-h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div>
                <h3 className="font-medium text-base text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  ساعت‌های هوشمند
                </h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400">تیتانیوم و سافایر</span>
              </div>
            </div>

            {/* Tile 3: Pro Laptops */}
            <div
              onClick={() => {
                setActiveCategoryFilter('laptops');
                onNavigate('products');
              }}
              className="group cursor-pointer p-6 rounded-2xl border transition-all flex flex-col justify-between h-[310px] bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#1c1c21] border-slate-200 dark:border-white/[0.05] hover:border-blue-500/50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                  31 مدل
                </span>
                <span className="material-symbols-outlined text-slate-400 dark:text-zinc-400 group-hover:text-blue-500 group-hover:-translate-x-1 transition-all text-lg">
                  arrow_back
                </span>
              </div>
              <div className="my-auto flex items-center justify-center h-36">
                <img
                  src="/images/products/macbook-pro-16.png"
                  alt="لپ‌تاپ پرو"
                  className="product-cutout max-h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div>
                <h3 className="font-medium text-base text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  لپ‌تاپ پرو
                </h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400">معماری اپل سیلیکون</span>
              </div>
            </div>

            {/* Tile 4: Earbuds */}
            <div
              onClick={() => {
                setActiveCategoryFilter('earbuds');
                onNavigate('products');
              }}
              className="group cursor-pointer p-6 rounded-2xl border transition-all flex flex-col justify-between h-[310px] bg-white dark:bg-[#161619] hover:bg-slate-50 dark:hover:bg-[#1c1c21] border-slate-200 dark:border-white/[0.05] hover:border-blue-500/50 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                  19 مدل
                </span>
                <span className="material-symbols-outlined text-slate-400 dark:text-zinc-400 group-hover:text-blue-500 group-hover:-translate-x-1 transition-all text-lg">
                  arrow_back
                </span>
              </div>
              <div className="my-auto flex items-center justify-center h-36">
                <img
                  src="/images/products/airpods-pro-2.png"
                  alt="ایرپاد و بی‌سیم"
                  className="product-cutout max-h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div>
                <h3 className="font-medium text-base text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                  ایرپاد و بی‌سیم
                </h3>
                <span className="text-xs text-slate-500 dark:text-zinc-400">عایق فعال نویز</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TIME-LIMITED FLASH SALE / FESTIVAL SECTION */}
      {campaign && campaign.isActive && flashProducts.length > 0 && (
      <section className="w-full px-4 sm:px-6 lg:px-10 py-12 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10">
          {/* Header Card with Persistent Countdown */}
          <div className="p-6 md:p-8 rounded-3xl border transition-colors shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 bg-gradient-to-r from-white via-blue-50/40 to-white dark:from-[#141418] dark:via-[#16161c] dark:to-[#121215] border-slate-200 dark:border-white/[0.06]">
            <div className="flex flex-col gap-2 text-right w-full lg:w-auto">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-600/15 text-blue-500 border border-blue-500/25 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg animate-pulse">timer</span>
                </span>
                <span className="font-mono text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 font-semibold">
                  جشنواره فروش محدود
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 font-medium">
                  LIVE FLASH DEALS
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                پیشنهادهای ویژه زمان‌دار
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                تخفیف‌های انحصاری گجت‌های پرچمدار با اعتبار محدود تا اتمام موجودی جشنواره.
              </p>
            </div>

            {/* Countdown Blocks */}
            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
              <div className="flex items-center gap-2" dir="ltr">
                {/* Days */}
                <div className="flex flex-col items-center justify-center w-14 sm:w-16 h-16 rounded-2xl border shadow-inner bg-white dark:bg-[#0f0f13] border-slate-200 dark:border-white/[0.08]">
                  <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {timeLeft.days}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">روز</span>
                </div>
                <span className="text-blue-500 font-bold text-lg -mt-3">:</span>
                {/* Hours */}
                <div className="flex flex-col items-center justify-center w-14 sm:w-16 h-16 rounded-2xl border shadow-inner bg-white dark:bg-[#0f0f13] border-slate-200 dark:border-white/[0.08]">
                  <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {timeLeft.hours}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">ساعت</span>
                </div>
                <span className="text-blue-500 font-bold text-lg -mt-3">:</span>
                {/* Minutes */}
                <div className="flex flex-col items-center justify-center w-14 sm:w-16 h-16 rounded-2xl border shadow-inner bg-white dark:bg-[#0f0f13] border-slate-200 dark:border-white/[0.08]">
                  <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {timeLeft.minutes}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">دقیقه</span>
                </div>
                <span className="text-blue-500 font-bold text-lg -mt-3">:</span>
                {/* Seconds */}
                <div className="flex flex-col items-center justify-center w-14 sm:w-16 h-16 rounded-2xl border shadow-[0_0_15px_rgba(59,130,246,0.2)] bg-blue-50 dark:bg-[#0f0f13] border-blue-500/30">
                  <span className="font-mono text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {timeLeft.seconds}
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">ثانیه</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('special-offers')}
                className="px-5 py-3 rounded-full border text-xs sm:text-sm font-medium transition-all flex items-center gap-2 group bg-white dark:bg-[#18181c] text-slate-800 dark:text-white border-slate-200 dark:border-white/[0.08] hover:border-blue-500 cursor-pointer"
              >
                <span>مشاهده همه پیشنهادها</span>
                <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">
                  arrow_back
                </span>
              </button>
            </div>
          </div>

          {/* Flash Deals Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {flashProducts.map((item) => {
              const defaultVariant = item.variants[0];
              const customDiscount = campaign?.productDiscounts?.[item.id];
              const discountPercent = customDiscount !== undefined
                ? customDiscount
                : item.compareAtPrice
                ? Math.round(((item.compareAtPrice - item.basePrice) / item.compareAtPrice) * 100)
                : (campaign?.discountPercent || 9);

              return (
                <div
                  key={item.id}
                  className="group relative rounded-2xl border transition-all flex flex-col p-5 shadow-lg bg-white dark:bg-[#161619] hover:bg-slate-50/80 dark:hover:bg-[#1a1a20] border-slate-200 dark:border-white/[0.05] hover:border-blue-500/50"
                >
                  <div className="flex items-center justify-between mb-3 z-10">
                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-semibold shadow-sm">
                      {discountPercent}٪ تخفیف
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 font-medium">
                        فروش ویژه
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item);
                        }}
                        title={isFavorite(item.id) ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                        className={`w-7 h-7 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-xs border ${
                          isFavorite(item.id)
                            ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-200 dark:border-rose-500/20'
                            : 'bg-slate-100 dark:bg-zinc-800/60 text-slate-400 dark:text-zinc-400 hover:text-rose-500 border-slate-200 dark:border-white/[0.06]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">favorite</span>
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => onNavigate('product-details', item.id)}
                    className="cursor-pointer relative w-full h-48 rounded-xl flex items-center justify-center p-3 mb-4 overflow-hidden bg-slate-50 dark:bg-[#0A0A0C]"
                  >
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      className="product-cutout max-h-36 w-auto object-contain group-hover:scale-105 transition-transform duration-500 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)]"
                    />
                  </div>

                  <div className="flex flex-col gap-2 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                        {item.brand}
                      </span>
                      <div className="flex items-center gap-1 text-blue-500">
                        <span className="material-symbols-outlined text-xs">star</span>
                        <span className="font-mono text-xs text-slate-800 dark:text-white font-semibold">
                          {item.rating}
                        </span>
                      </div>
                    </div>

                    <h3
                      onClick={() => onNavigate('product-details', item.id)}
                      className="cursor-pointer text-sm font-semibold truncate text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors"
                    >
                      {item.name}
                    </h3>

                    {/* Stock remaining meter */}
                    <div className="flex flex-col gap-1 my-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-rose-500 font-medium">
                          تنها {defaultVariant.stock} عدد باقی‌مانده در انبار
                        </span>
                        <span className="font-mono text-slate-400 dark:text-zinc-500 text-[10px]">85٪ فروخته شده</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-l from-blue-500 to-rose-500 w-[85%]" />
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-100 dark:border-white/[0.04]">
                      <div className="flex flex-col">
                        {item.compareAtPrice && (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 line-through">
                            {formatPrice(item.compareAtPrice)}
                          </span>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="font-display text-lg font-bold font-mono text-slate-900 dark:text-white">
                            {formatPrice(item.basePrice)}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400">تومان</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        addToCart(item, defaultVariant);
                      }}
                      className="w-full mt-2.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">shopping_bag</span>
                      <span>خرید محصول</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* 4. CURATED HIGHLIGHT BANNER: APPLE WATCH ULTRA 2 */}
      {ultraWatch && (
        <section className="w-full px-4 sm:px-6 lg:px-10 py-12">
          <div className="max-w-7xl mx-auto rounded-3xl border overflow-hidden relative shadow-2xl transition-colors bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.06]">
            <div className="absolute -right-20 top-0 w-80 h-80 rounded-full blur-[100px] pointer-events-none bg-blue-400/20 dark:bg-blue-600/20" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 md:p-12 items-center relative z-10">
              {/* Text info */}
              <div className="lg:col-span-7 flex flex-col gap-5 text-right">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-mono text-xs font-semibold uppercase tracking-wider shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                    پیشنهاد ویژه
                  </span>
                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
                    موجودی محدود
                  </span>
                </div>

                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  اپل واچ اولترا 2 تیتانیوم
                </h2>

                <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-lg leading-relaxed font-light">
                  ساعت فوق‌مقاوم با بدنه تیتانیومی گرید هوافضا، روشنایی 3000 نیت و جی‌پی‌اس دوفرکانسه دقیق.
                </p>

                <div className="flex items-baseline gap-4 pt-1">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 block">
                      قیمت ویژه:
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                        {formatPrice(ultraWatch.basePrice)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400">تومان</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-blue-500 mr-auto">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className="material-symbols-outlined text-sm">star</span>
                    ))}
                    <span className="font-mono text-xs text-slate-800 dark:text-white mr-1 font-semibold">
                      ({ultraWatch.rating})
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      addToCart(ultraWatch, ultraWatch.variants[0]);
                      onNavigate('cart');
                    }}
                    className="px-7 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">bolt</span>
                    <span>خرید مستقیم</span>
                  </button>
                  <button
                    onClick={() => onNavigate('product-details', ultraWatch.id)}
                    className="px-6 py-3 rounded-full border text-xs sm:text-sm font-medium transition-all bg-slate-100 dark:bg-[#18181c] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.08] hover:text-blue-600 dark:hover:text-white cursor-pointer"
                  >
                    مشاهده کالا
                  </button>
                </div>
              </div>

              {/* Watch isolated cutout */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-blue-600/10 blur-2xl" />
                  <img
                    src={ultraWatch.images[0]}
                    alt={ultraWatch.name}
                    className="product-cutout relative z-10 w-full h-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.9)] hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="absolute top-2 right-2 px-3 py-1.5 rounded-xl border flex items-center gap-2 bg-white/90 dark:bg-[#18181c]/80 border-slate-200 dark:border-white/[0.06] shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-mono text-[11px] text-slate-900 dark:text-white font-semibold">
                    بدنه 49 میلی‌متری
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. FLAGSHIP CATALOG GRID WITH FILTER PILLS */}
      <section className="w-full px-4 sm:px-6 lg:px-10 py-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-500 font-semibold uppercase tracking-widest">
                کاتالوگ پرچمدار
              </span>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                جدیدترین محصولات
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'همه' },
                { id: 'audio', label: 'صوتی' },
                { id: 'watches', label: 'ساعت' },
                { id: 'laptops', label: 'لپ‌تاپ' },
                { id: 'smartphones', label: 'گوشی' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setActiveCategoryFilter(pill.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeCategoryFilter === pill.id
                      ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                      : 'border bg-white dark:bg-[#161619] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/[0.05] hover:text-blue-600 dark:hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCatalog.slice(0, 8).map((prod) => {
              const defaultVariant = prod.variants[0];
              return (
                <div
                  key={prod.id}
                  className="group relative rounded-2xl border transition-all flex flex-col p-5 shadow-lg bg-white dark:bg-[#161619] hover:bg-slate-50/70 dark:hover:bg-[#1a1a1f] border-slate-200 dark:border-white/[0.04] hover:border-blue-500/40"
                >
                  <div className="flex items-center justify-between mb-3 z-10">
                    <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold">
                      {prod.tags[0] || 'پرچمدار'}
                    </span>
                    <button
                      onClick={() => toggleFavorite(prod)}
                      title={isFavorite(prod.id) ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                      className={`w-8 h-8 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-xs border ${
                        isFavorite(prod.id)
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-200 dark:border-rose-500/20'
                          : 'bg-slate-100 dark:bg-zinc-800/60 text-slate-400 dark:text-zinc-400 hover:text-rose-500 border-slate-200 dark:border-white/[0.06]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">favorite</span>
                    </button>
                  </div>

                  <div
                    onClick={() => onNavigate('product-details', prod.id)}
                    className="cursor-pointer relative w-full h-44 rounded-xl flex items-center justify-center p-3 mb-4 overflow-hidden bg-slate-50 dark:bg-[#0A0A0C]"
                  >
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      className="product-cutout max-h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                        {prod.brand}
                      </span>
                      <div className="flex items-center gap-1 text-blue-500">
                        <span className="material-symbols-outlined text-xs">star</span>
                        <span className="font-mono text-xs text-slate-800 dark:text-white font-semibold">
                          {prod.rating}
                        </span>
                      </div>
                    </div>

                    <h3
                      onClick={() => onNavigate('product-details', prod.id)}
                      className="cursor-pointer text-sm font-semibold truncate text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors"
                    >
                      {prod.name}
                    </h3>

                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="font-display text-lg font-bold font-mono text-slate-900 dark:text-white">
                        {formatPrice(prod.basePrice)}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">تومان</span>
                    </div>

                    <button
                      onClick={() => addToCart(prod, defaultVariant)}
                      className="w-full mt-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-[#1e1e24] hover:bg-blue-600 hover:text-white text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-white/[0.06] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                      <span>افزودن به سبد</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. TRUST PILLARS (3 CARDS) */}
      <section className="w-full px-4 sm:px-6 lg:px-10 py-16 border-y bg-white dark:bg-[#0E0E11] border-slate-200 dark:border-white/[0.04]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
          <div className="p-6 rounded-2xl border flex flex-col gap-3 transition-colors bg-slate-50 dark:bg-[#161619] border-slate-200 dark:border-white/[0.04] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">verified</span>
            </div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">
              اصالت تضمینی کالا
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-light">
              استعلام مستقیم سریال نامبر در وبسایت رسمی کمپانی سازنده با گارانتی تعویض فیزیکی.
            </p>
          </div>

          <div className="p-6 rounded-2xl border flex flex-col gap-3 transition-colors bg-slate-50 dark:bg-[#161619] border-slate-200 dark:border-white/[0.04] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">rocket_launch</span>
            </div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">
              ارسال اختصاصی اکسپرس
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-light">
              بسته‌بندی ایمن ضدضربه و تحویل فوری همراه با بیمه کامل حمل کالا.
            </p>
          </div>

          <div className="p-6 rounded-2xl border flex flex-col gap-3 transition-colors bg-slate-50 dark:bg-[#161619] border-slate-200 dark:border-white/[0.04] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">support_agent</span>
            </div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">
              مشاوره تخصصی خرید
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-light">
              راهنمایی فنی با دستیار هوشمند جهت انتخاب بهترین گجت متناسب با بودجه شما.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
