import React, { useEffect, useState, useCallback } from 'react';
import type { Product, ProductVariant, Review } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useFavorites } from '../context/FavoritesContext.tsx';
import { useComparison } from '../context/ComparisonContext.tsx';
import { formatPrice } from '../utils/format.ts';

interface ProductDetailsPageProps {
  productId: string;
  onNavigate: (path: string, id?: string) => void;
}

interface ReviewStats {
  average: number;
  total: number;
  distribution: { [stars: number]: number };
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({ productId, onNavigate }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    average: 5,
    total: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<string>('1 ترابایت');
  const [selectedColor, setSelectedColor] = useState<string>('مشکی فضایی (Space Black)');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Review & Rating State
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState<boolean>(false);
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalReviewsCount, setTotalReviewsCount] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Submit / Edit Review Form
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');

  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { user, openAuthModal, token } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isInComparison, addToComparison, removeFromComparison } = useComparison();

  // Load reviews with pagination & sort
  const loadReviews = useCallback(
    async (prodId: string, page = 1, sort = 'newest') => {
      try {
        const headers: Record<string, string> = {};
        const authToken = token || localStorage.getItem('voltro_auth_token');
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const res = await fetch(`/api/products/${prodId}/reviews?page=${page}&limit=5&sortBy=${sort}`, {
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews || []);
          setTotalReviewsCount(data.total || 0);
          setTotalPages(data.totalPages || 1);
          setReviewPage(data.page || 1);
          if (data.stats) {
            setReviewStats(data.stats);
          }
          if (data.userReview) {
            setUserReview(data.userReview);
            setEditRating(data.userReview.rating);
            setEditComment(data.userReview.comment);
          } else {
            setUserReview(null);
          }
          if (data.isVerifiedPurchase !== undefined) {
            setIsVerifiedPurchase(data.isVerifiedPurchase);
          }
        }
      } catch (err) {
        console.warn('Failed to load reviews:', err);
      }
    },
    [token]
  );

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

    loadReviews(targetId, 1, sortBy);
  }, [productId, loadReviews, sortBy]);

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

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!newComment.trim()) {
      showToast('لطفاً متن نظر خود را وارد کنید.', 'error');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const authToken = token || localStorage.getItem('voltro_auth_token');
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
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
        setNewComment('');
        showToast('دیدگاه شما با موفقیت ثبت شد.', 'success');
        if (product) {
          loadReviews(product.id, 1, sortBy);
        }
      } else {
        showToast(data.error || 'خطا در ثبت نظر.', 'error');
      }
    } catch {
      setIsSubmittingReview(false);
      showToast('خطا در برقراری ارتباط با سرور.', 'error');
    }
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userReview) return;
    if (!editComment.trim()) {
      showToast('متن نظر نمی‌تواند خالی باشد.', 'error');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const authToken = token || localStorage.getItem('voltro_auth_token');
      const res = await fetch(`/api/reviews/${userReview.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          rating: editRating,
          comment: editComment.trim(),
        }),
      });

      setIsSubmittingReview(false);
      if (res.ok) {
        showToast('دیدگاه شما با موفقیت ویرایش شد.', 'success');
        setIsEditingReview(false);
        if (product) loadReviews(product.id, reviewPage, sortBy);
      } else {
        const errData = await res.json();
        showToast(errData.error || 'خطا در ویرایش نظر.', 'error');
      }
    } catch {
      setIsSubmittingReview(false);
      showToast('خطا در ویرایش نظر.', 'error');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('آیا از حذف این دیدگاه اطمینان دارید؟')) return;

    try {
      const authToken = token || localStorage.getItem('voltro_auth_token');
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        showToast('دیدگاه حذف شد.', 'info');
        if (userReview?.id === reviewId) {
          setUserReview(null);
          setIsEditingReview(false);
        }
        if (product) loadReviews(product.id, 1, sortBy);
      } else {
        const errData = await res.json();
        showToast(errData.error || 'خطا در حذف نظر.', 'error');
      }
    } catch {
      showToast('خطا در حذف نظر.', 'error');
    }
  };

  const handleToggleHelpful = async (reviewId: string) => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    try {
      const authToken = token || localStorage.getItem('voltro_auth_token');
      const res = await fetch(`/api/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setReviews((prev) =>
          prev.map((r) => {
            if (r.id === reviewId) {
              const currentVoted = r.helpfulUserIds?.includes(user.id) || false;
              const nextIds = currentVoted
                ? (r.helpfulUserIds || []).filter((id) => id !== user.id)
                : [...(r.helpfulUserIds || []), user.id];
              return {
                ...r,
                helpfulCount: data.helpfulCount,
                helpfulUserIds: nextIds,
              };
            }
            return r;
          })
        );
      }
    } catch {
      // ignore
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
          {/* Visual Hero Canvas */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.12)_0%,_transparent_70%)] pointer-events-none" />
            <div className="relative w-full max-w-[560px] aspect-square flex items-center justify-center p-6 lg:p-10 rounded-3xl border shadow-xl bg-white dark:bg-[#121214] border-slate-200 dark:border-white/[0.05]">
              <div className="absolute bottom-10 w-3/4 h-8 bg-blue-400/20 dark:bg-blue-500/20 blur-2xl rounded-full pointer-events-none" />
              <img
                src={selectedVariant?.image || product.images[0]}
                alt={product.name}
                loading="eager"
                decoding="async"
                className="product-cutout relative z-10 w-full h-auto max-h-[380px] object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.85)] hover:scale-[1.03] transition-transform duration-700 select-none"
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-zinc-400 mt-4 px-4 py-1.5 rounded-full border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>طراحی یکپارچه پرچمدار • {selectedColor}</span>
            </div>
          </div>

          {/* Configurator Column */}
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
                <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">{selectedColor}</span>
              </div>
              <div className="flex items-center gap-2.5">
                {Array.from(new Set(product.variants.map((v) => v.colorName))).map((color) => {
                  const isSelected = selectedColor === color;
                  const v = product.variants.find((item) => item.colorName === color);
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorChange(color)}
                      title={color}
                      className={`relative w-8 h-8 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-white dark:ring-offset-[#0B0B0C] scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      <span
                        className="w-full h-full rounded-full border border-slate-300 dark:border-white/20 shadow-xs"
                        style={{ backgroundColor: v?.colorHex || '#1e293b' }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Storage Variants */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-900 dark:text-white font-semibold">حافظه و کانفیگ:</span>
                <span className="text-blue-600 dark:text-blue-500 font-mono font-medium">{selectedStorage}</span>
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
                          isActive ? 'text-white/80' : 'text-slate-400 dark:text-zinc-500'
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
                  type="button"
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

                {/* Compare Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isInComparison(product.id)) {
                      removeFromComparison(product.id);
                    } else {
                      addToComparison(product);
                    }
                  }}
                  title={isInComparison(product.id) ? 'حذف از مقایسه' : 'افزودن به مقایسه رو در رو'}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                    isInComparison(product.id)
                      ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-500 border-amber-300 dark:border-amber-500/40'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-amber-500 border-slate-200 dark:border-white/[0.08]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">compare_arrows</span>
                </button>

                {/* Wishlist Button */}
                <button
                  type="button"
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

        {/* Key Technical Specs Grid */}
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
            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">memory</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">پردازنده و معماری</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications?.chipset || product.specifications?.processor || 'پردازنده نسل جدید پرچمدار'}
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">desktop_windows</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">نمایشگر و روشنایی</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications?.displaySize
                    ? `${product.specifications.displaySize} - ${product.specifications?.displayTech || 'Super AMOLED'}`
                    : product.specifications?.display || 'نمایشگر پیشرفته با نرخ نوسازی روان'}
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">battery_charging_full</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">عمر باتری و شارژ</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications?.batteryCapacity
                    ? `${product.specifications.batteryCapacity} (${product.specifications?.chargingSpeed || 'شارژ سریع'})`
                    : product.specifications?.battery || 'شارژدهی تمام‌روزه'}
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border flex flex-col gap-3 bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">photo_camera</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">سیستم دوربین</h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {product.specifications?.mainCamera || product.specifications?.camera || 'سنسور پیشرفته با هوش مصنوعی'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CUSTOMER REVIEWS & RATING SYSTEM */}
        <div className="pt-16 pb-10 border-t border-slate-200 dark:border-white/[0.06] text-right">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-500 font-semibold tracking-wider">
                REVIEWS & RATINGS
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                نظرات و امتیاز خریداران ({totalReviewsCount})
              </h2>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-zinc-400">مرتب‌سازی:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white dark:bg-[#161619] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-800 dark:text-zinc-200 px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
              >
                <option value="newest">جدیدترین نظرات</option>
                <option value="highest-rating">بیشترین امتیاز (۵ ستاره)</option>
                <option value="lowest-rating">کمترین امتیاز</option>
                <option value="most-helpful">مفیدترین نظرات</option>
              </select>
            </div>
          </div>

          {/* Rating Breakdown & Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 rounded-3xl border bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] shadow-sm mb-8">
            {/* Score Summary */}
            <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-l border-slate-200 dark:border-white/[0.06] pb-6 md:pb-0 md:pl-6 text-center">
              <div className="text-5xl font-black font-display text-amber-500">
                {reviewStats.average.toFixed(1)}
              </div>
              <div className="flex items-center gap-1 my-2 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`material-symbols-outlined text-lg ${
                      i < Math.round(reviewStats.average) ? 'text-amber-500' : 'text-zinc-600'
                    }`}
                  >
                    star
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                بر اساس {totalReviewsCount} دیدگاه ثبت‌شده کاربران
              </p>
            </div>

            {/* Rating Bars Distribution */}
            <div className="md:col-span-8 flex flex-col justify-center gap-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviewStats.distribution[stars] || 0;
                const percent = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-3 text-xs">
                    <span className="w-12 text-slate-600 dark:text-zinc-400 font-mono text-left" dir="ltr">
                      {stars} ★
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-16 text-slate-500 dark:text-zinc-500 font-mono text-right text-[11px]">
                      {count} ({percent}٪)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Reviews List & Pagination */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {reviews.length === 0 ? (
                <div className="p-8 rounded-2xl border text-center text-xs text-slate-500 dark:text-zinc-500 bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.06]">
                  هنوز دیدگاهی برای این کالا ثبت نشده است. اولین نظر را شما بنویسید!
                </div>
              ) : (
                reviews.map((rev) => {
                  const isAuthor = user && rev.userId === user.id;
                  const isAdmin = user?.role === 'admin';
                  const hasVoted = user && rev.helpfulUserIds?.includes(user.id);

                  return (
                    <div
                      key={rev.id}
                      className="p-5 rounded-2xl border bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.05] shadow-xs hover:border-slate-300 dark:hover:border-white/[0.1] transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {rev.userName}
                          </span>
                          {rev.isVerifiedPurchase && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                              ✓ خریدار تاییدشده
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                            {new Date(rev.createdAt).toLocaleDateString('fa-IR')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={`material-symbols-outlined text-xs ${
                                i < rev.rating ? 'text-amber-500' : 'text-zinc-600'
                              }`}
                            >
                              star
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed my-3">
                        {rev.comment}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.04]">
                        {/* Helpful vote button */}
                        <button
                          type="button"
                          onClick={() => handleToggleHelpful(rev.id)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            hasVoted
                              ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-500/30'
                              : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/[0.06] hover:text-blue-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">thumb_up</span>
                          <span>مفید بود</span>
                          {(rev.helpfulCount || 0) > 0 && <span className="font-mono">({rev.helpfulCount})</span>}
                        </button>

                        {/* Actions for Author or Admin */}
                        {(isAuthor || isAdmin) && (
                          <div className="flex items-center gap-2">
                            {isAuthor && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingReview(true);
                                  setEditRating(rev.rating);
                                  setEditComment(rev.comment);
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                ویرایش
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(rev.id)}
                              className="text-xs text-rose-500 hover:text-rose-400 transition-colors"
                            >
                              حذف نظر
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-2">
                  <button
                    type="button"
                    disabled={reviewPage <= 1}
                    onClick={() => {
                      const next = Math.max(1, reviewPage - 1);
                      if (product) loadReviews(product.id, next, sortBy);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${
                      reviewPage <= 1
                        ? 'opacity-40 cursor-not-allowed border-zinc-700 text-zinc-500'
                        : 'border-slate-200 dark:border-zinc-700 hover:bg-zinc-800 text-zinc-200 cursor-pointer'
                    }`}
                  >
                    صفحه قبلی
                  </button>
                  <span className="text-xs font-mono text-zinc-400 px-2">
                    {reviewPage} از {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={reviewPage >= totalPages}
                    onClick={() => {
                      const next = Math.min(totalPages, reviewPage + 1);
                      if (product) loadReviews(product.id, next, sortBy);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${
                      reviewPage >= totalPages
                        ? 'opacity-40 cursor-not-allowed border-zinc-700 text-zinc-500'
                        : 'border-slate-200 dark:border-zinc-700 hover:bg-zinc-800 text-zinc-200 cursor-pointer'
                    }`}
                  >
                    صفحه بعدی
                  </button>
                </div>
              )}
            </div>

            {/* User Review or Review Submission Form */}
            <div className="lg:col-span-5">
              {userReview && !isEditingReview ? (
                <div className="p-6 rounded-2xl border bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-amber-500 dark:text-amber-400 flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      دیدگاه ثبت‌شده شما
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingReview(true)}
                        className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-lg transition-colors cursor-pointer"
                      >
                        ویرایش
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(userReview.id)}
                        className="text-xs text-rose-500 hover:text-rose-400 px-2.5 py-1 transition-colors"
                      >
                        حذف
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-amber-500 mb-2">
                    {Array.from({ length: userReview.rating }).map((_, i) => (
                      <span key={i} className="material-symbols-outlined text-xs">
                        star
                      </span>
                    ))}
                    <span className="text-xs font-mono text-zinc-400 mr-2">
                      ({userReview.rating} از ۵)
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed bg-white/60 dark:bg-black/30 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {userReview.comment}
                  </p>

                  <p className="text-[11px] text-zinc-400 mt-3">
                    شما قبلاً نظر خود را ثبت کرده‌اید. در صورت تغییر دیدگاه می‌توانید آن را ویرایش نمایید.
                  </p>
                </div>
              ) : isEditingReview && userReview ? (
                /* EDIT FORM */
                <div className="p-6 rounded-2xl border bg-white dark:bg-[#161619] border-blue-500/30 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      ویرایش دیدگاه شما
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingReview(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      انصراف
                    </button>
                  </div>
                  <form onSubmit={handleUpdateReview} className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">
                        امتیاز شما:
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setEditRating(num)}
                            className={`p-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                              editRating >= num
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                                : 'border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-transparent'
                            }`}
                          >
                            {num} ★
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">
                        متن دیدگاه:
                      </label>
                      <textarea
                        rows={4}
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="تجربه و ارزیابی خود از محصول را بنویسید..."
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#121214] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.08] outline-none resize-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isSubmittingReview ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingReview(false)}
                        className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                      >
                        انصراف
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* NEW REVIEW FORM */
                <div className="p-6 rounded-2xl border bg-white dark:bg-[#161619] border-slate-200 dark:border-white/[0.06] shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      ثبت تجربه و نظر شما
                    </h3>
                    {isVerifiedPurchase && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                        شما این کالا را خریده‌اید
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleAddReview} className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">
                        امتیاز شما به این محصول:
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setNewRating(num)}
                            className={`p-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                              newRating >= num
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold'
                                : 'border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-transparent'
                            }`}
                          >
                            {num} ★
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">
                        متن دیدگاه:
                      </label>
                      <textarea
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="کیفیت ساخت، عملکرد یا تجربه استفاده خود را بنویسید..."
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#121214] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.08] outline-none resize-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingReview}
                      className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>{isSubmittingReview ? 'در حال ارسال...' : 'ارسال دیدگاه'}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
