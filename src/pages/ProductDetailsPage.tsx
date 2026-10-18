import React, { useEffect, useState } from 'react';
import type { Product, ProductVariant, Review } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useFavorites } from '../context/FavoritesContext.tsx';
import { formatPrice } from '../utils/format.ts';

interface ProductDetailsPageProps {
  productId: string;
  onNavigate: (path: string, id?: string) => void;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({ productId, onNavigate }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<string>('1 ترابایت');
  const [selectedColor, setSelectedColor] = useState<string>('مشکی فضایی (Space Black)');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Review form
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { user, openAuthModal } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    setIsLoading(true);
    const targetId = productId || 'prod-macbook-pro-16';

    fetch(`/api/products/${targetId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setProduct(data.product);
        setReviews(data.reviews || []);
        setRelatedProducts(data.relatedProducts || []);
        if (data.product.variants && data.product.variants.length > 0) {
          const preferred =
            data.product.variants.find((v: ProductVariant) => v.storage.includes('1 ترابایت')) ||
            data.product.variants[0];
          setSelectedVariant(preferred);
          setSelectedStorage(preferred.storage);
          setSelectedColor(preferred.colorName);
        }
      })
      .catch((err) => {
        console.error('Error fetching product:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [productId]);

  const handleColorChange = (colorName: string) => {
    setSelectedColor(colorName);
    if (!product) return;
    const match = product.variants.find(
      (v) => v.colorName.includes(colorName) || colorName.includes(v.colorName)
    );
    if (match) {
      setSelectedVariant(match);
      setSelectedStorage(match.storage);
    }
  };

  const handleStorageChange = (storage: string) => {
    setSelectedStorage(storage);
    if (!product) return;
    const match = product.variants.find((v) => v.storage === storage);
    if (match) {
      setSelectedVariant(match);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('voltro_auth_token')}`,
        },
        body: JSON.stringify({
          productId: product?.id,
          rating: newRating,
          comment: newComment.trim(),
        }),
      });
      const data = await res.json();
      setIsSubmittingReview(false);
      if (res.ok) {
        setReviews([data.review, ...reviews]);
        setNewComment('');
        showToast('دیدگاه شما با موفقیت ثبت شد.', 'success');
      } else {
        showToast(data.error || 'خطا در ثبت نظر.', 'error');
      }
    } catch (err) {
      setIsSubmittingReview(false);
      showToast('خطا در برقراری ارتباط با سرور.', 'error');
    }
  };

  if (isLoading || !product) {
    return (
      <div className="w-full min-h-screen pt-28 flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B0B0C]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">در حال بارگذاری جزئیات کالا...</span>
        </div>
      </div>
    );
  }

  const currentPrice = selectedVariant ? selectedVariant.price : product.basePrice;

  return (
    <div className="w-full min-h-screen pt-20 transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 md:py-14">
        {/* Breadcrumb Bar */}
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-slate-500 dark:text-zinc-400 pb-8 border-b border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate('home')} className="hover:text-blue-500 transition-colors cursor-pointer">
              فروشگاه
            </button>
            <span className="text-slate-300 dark:text-zinc-600">/</span>
            <button onClick={() => onNavigate('products')} className="hover:text-blue-500 transition-colors cursor-pointer">
              {product.brand}
            </button>
            <span className="text-slate-300 dark:text-zinc-600">/</span>
            <span className="text-slate-900 dark:text-white font-medium truncate">
              {product.name}
            </span>
          </div>

          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium px-3 py-1 rounded-full border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>موجود در انبار اختصاصی ولترو ({selectedVariant?.stock || product.stockTotal} عدد)</span>
          </div>
        </div>

        {/* Hero Product Bento Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center pt-10 pb-16">
          {/* Visual Hero Canvas (RTL Right side) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.12)_0%,_transparent_70%)] pointer-events-none" />
            <div className="relative w-full max-w-[560px] aspect-square flex items-center justify-center p-6 lg:p-10 rounded-3xl border shadow-xl bg-white dark:bg-[#121214] border-slate-200 dark:border-white/[0.05]">
              {/* Floor ambient glow */}
              <div className="absolute bottom-10 w-3/4 h-8 bg-blue-400/20 dark:bg-blue-500/20 blur-2xl rounded-full pointer-events-none" />

              <img
                src={selectedVariant?.image || product.images[0]}
                alt={product.name}
                className="product-cutout relative z-10 w-full h-auto max-h-[380px] object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.85)] hover:scale-[1.03] transition-transform duration-700 select-none"
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-zinc-400 mt-4 px-4 py-1.5 rounded-full border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>طراحی یکپارچه آلیاژ تیتانیوم و آلومینیوم • {selectedColor}</span>
            </div>
          </div>

          {/* Minimalist Configurator Column (RTL Left side) */}
          <div className="lg:col-span-5 flex flex-col gap-6 text-right">
            <div className="flex flex-col gap-2.5">
              <div className="inline-flex items-center gap-2 font-mono text-xs text-blue-600 dark:text-blue-500 uppercase tracking-wider font-semibold">
                <span>{product.brand.toUpperCase()} ARCHITECTURE</span>
                <span>•</span>
                <span>SERIES 2024</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight font-display">
                {product.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-light">
                {product.subtitle}
              </p>
            </div>

            {/* Color Swatch Selector */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-900 dark:text-white font-semibold">رنگ بدنه:</span>
                <span className="font-mono text-slate-500 dark:text-zinc-400">
                  {selectedColor}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleColorChange('مشکی فضایی (Space Black)')}
                  className={`w-9 h-9 rounded-full bg-[#18181b] transition-all flex items-center justify-center ring-offset-2 cursor-pointer ${
                    selectedColor.includes('مشکی')
                      ? 'ring-2 ring-blue-500 ring-offset-white dark:ring-offset-black'
                      : 'ring-2 ring-transparent opacity-80 hover:opacity-100'
                  }`}
                  title="مشکی فضایی"
                >
                  <span className="sr-only">مشکی فضایی</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleColorChange('نقره‌ای پلاتینیوم (Silver)')}
                  className={`w-9 h-9 rounded-full bg-[#d4d4d8] transition-all flex items-center justify-center ring-offset-2 cursor-pointer ${
                    selectedColor.includes('نقره‌ای')
                      ? 'ring-2 ring-blue-500 ring-offset-white dark:ring-offset-black'
                      : 'ring-2 ring-transparent opacity-80 hover:opacity-100'
                  }`}
                  title="نقره‌ای"
                >
                  <span className="sr-only">نقره‌ای</span>
                </button>
                {selectedColor.includes('طبیعی') && (
                  <button
                    type="button"
                    className="w-9 h-9 rounded-full bg-[#9a948c] ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-black"
                    title="تیتانیوم طبیعی"
                  />
                )}
              </div>
            </div>

            {/* Storage Selector */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-900 dark:text-white font-semibold">
                  حافظه و کانفیگ سخت‌افزار:
                </span>
                <span className="font-mono text-slate-500 dark:text-zinc-400">
                  سرعت خواندن 7.4 گیگابایت/ثانیه
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {product.variants.slice(0, 3).map((v) => {
                  const isActive = selectedVariant?.id === v.id;
                  const delta = v.price - product.basePrice;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-3 rounded-2xl border text-right flex flex-col gap-1 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.35)]'
                          : 'border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#161619] text-slate-700 dark:text-zinc-300 hover:border-blue-500/40 shadow-xs'
                      }`}
                    >
                      <span className="text-xs font-semibold">{v.storage}</span>
                      <span
                        className={`font-mono text-[10px] ${
                          isActive
                            ? 'text-white/80'
                            : 'text-slate-400 dark:text-zinc-500'
                        }`}
                      >
                        {delta > 0 ? `+ ${formatPrice(delta)} ت` : 'پایه'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price & Add to Cart Card */}
            <div className="p-6 rounded-2xl border flex flex-col gap-5 mt-2 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.06] shadow-md">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-500 dark:text-zinc-400">قیمت نهایی:</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                    {formatPrice(currentPrice)}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-500 font-bold">تومان</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (selectedVariant) {
                      addToCart(product, selectedVariant, 1);
                    }
                  }}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(37,99,235,0.4)] transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">shopping_bag</span>
                  <span>افزودن به سبد خرید</span>
                </button>
                <button
                  onClick={() => toggleFavorite(product)}
                  title={isFavorite(product.id) ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                    isFavorite(product.id)
                      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-300 dark:border-rose-500/30'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-rose-500 border-slate-200 dark:border-white/[0.08]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">favorite</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Key Technical Specs Grid (4 Cards) */}
        <div className="pt-12 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="flex flex-col gap-2 mb-8 text-right">
            <span className="font-mono text-xs text-blue-600 dark:text-blue-500 uppercase tracking-wider font-semibold">
              TECHNICAL OVERVIEW
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              مشخصات کلیدی سخت‌افزار
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-right">
            {/* Spec 1: Chip */}
            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">memory</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  پردازنده و معماری
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications.processor}
                </p>
              </div>
            </div>

            {/* Spec 2: Display */}
            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">desktop_windows</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  نمایشگر و روشنایی
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications.display}
                </p>
              </div>
            </div>

            {/* Spec 3: Battery */}
            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">battery_charging_full</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  عمر باتری و شارژ
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications.battery}
                </p>
              </div>
            </div>

            {/* Spec 4: Ports & Connectivity */}
            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">cable</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  درگاه‌های ارتباطی
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications.ports}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews & Feedback Section */}
        <div className="pt-16 pb-10 border-t border-slate-200 dark:border-white/[0.06] text-right">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-500 font-semibold tracking-wider">REVIEWS & RATINGS</span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                نظرات خریداران تاییدشده ({reviews.length})
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-blue-500">
              <span className="material-symbols-outlined text-lg">star</span>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                {product.rating} از 5
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Reviews List */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {reviews.length === 0 ? (
                <div className="p-6 rounded-2xl border text-center text-xs text-slate-500 dark:text-zinc-500 bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06]">
                  هنوز دیدگاهی برای این کالا ثبت نشده است. اولین نظر را شما بنویسید!
                </div>
              ) : (
                reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 rounded-2xl border bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          {rev.userName}
                        </span>
                        {rev.isVerifiedPurchase && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                            خریدار تاییدشده
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <span key={i} className="material-symbols-outlined text-xs">
                            star
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                      {rev.comment}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add Review Form */}
            <div className="lg:col-span-5 p-6 rounded-2xl border bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.06] shadow-md">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                ثبت تجربه و نظر شما
              </h3>
              <form onSubmit={handleAddReview} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">امتیاز شما:</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setNewRating(num)}
                        className={`p-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                          newRating >= num
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-transparent'
                        }`}
                      >
                        {num} ستاره
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">متن دیدگاه:</label>
                  <textarea
                    rows={3}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="کیفیت ساخت، عملکرد یا تجربه استفاده..."
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#121214] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.08] outline-none resize-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>ارسال دیدگاه</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
