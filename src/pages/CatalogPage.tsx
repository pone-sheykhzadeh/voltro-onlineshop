import React, { useEffect, useState } from 'react';
import type { Product } from '../types/index.ts';
import { useCart } from '../context/CartContext.tsx';
import { useFavorites } from '../context/FavoritesContext.tsx';
import { formatPrice } from '../utils/format.ts';

interface CatalogPageProps {
  onNavigate: (path: string, productId?: string) => void;
  initialQuery?: string;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({ onNavigate, initialQuery = '' }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [isLoading, setIsLoading] = useState(true);

  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (selectedCategory !== 'all') params.append('category', selectedCategory);
    if (selectedBrand !== 'all') params.append('brand', selectedBrand);
    if (sortBy) params.append('sort', sortBy);

    fetch(`/api/products?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.products) setProducts(data.products);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [search, selectedCategory, selectedBrand, sortBy]);

  const categories = [
    { id: 'all', label: 'همه دسته‌ها' },
    { id: 'smartphones', label: 'گوشی‌های هوشمند' },
    { id: 'laptops', label: 'مک‌بوک و لپ‌تاپ' },
    { id: 'tablets', label: 'تبلت و آیپد' },
    { id: 'watches', label: 'ساعت‌های هوشمند' },
    { id: 'audio', label: 'صوتی و هدفون' },
    { id: 'earbuds', label: 'ایرپاد و بی‌سیم' },
  ];

  const brands = [
    { id: 'all', label: 'همه برندها' },
    { id: 'Apple', label: 'اپل (Apple)' },
    { id: 'Samsung', label: 'سامسونگ (Samsung)' },
    { id: 'Bang & Olufsen', label: 'بنگ اند اولوفسن' },
    { id: 'Sony', label: 'سونی (Sony)' },
  ];

  return (
    <div className="w-full min-h-screen pt-20 transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 text-right">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-200 dark:border-white/[0.06]">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              ویترین محصولات پرچمدار
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {products.length} کالا با ضمانت اصالت فیزیکی و گارانتی رسمی تعویض
            </p>
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 dark:text-zinc-500 text-sm pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو در محصولات..."
                className="w-56 pl-3 pr-9 py-2 rounded-xl text-xs bg-white dark:bg-[#141417] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.08] focus:border-blue-500 outline-none"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#141417] text-slate-900 dark:text-white border border-slate-200 dark:border-white/[0.08] outline-none cursor-pointer"
            >
              <option value="popular">محبوب‌ترین و پرفروش</option>
              <option value="price-asc">ارزان‌ترین قیمت</option>
              <option value="price-desc">گران‌ترین قیمت</option>
              <option value="rating">بیشترین امتیاز خریداران</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="py-6 flex flex-col gap-3">
          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'border bg-white dark:bg-[#141417] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/[0.06] hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Brands */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {brands.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBrand(b.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer ${
                  selectedBrand === b.id
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'border bg-white dark:bg-[#18181c] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/[0.04] hover:text-blue-600 dark:hover:text-white'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="py-24 flex items-center justify-center">
            <span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center text-xs text-slate-500 dark:text-zinc-500">
            هیچ محصولی با معیارهای جستجوی شما یافت نشد.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((item) => {
              const defaultVariant = item.variants[0];
              return (
                <div
                  key={item.id}
                  className="group relative rounded-2xl border transition-all flex flex-col p-5 shadow-lg bg-white dark:bg-[#161619] hover:bg-slate-50/80 dark:hover:bg-[#1a1a20] border-slate-200 dark:border-white/[0.04] hover:border-blue-500/40"
                >
                  <div className="flex items-center justify-between mb-3 z-10">
                    <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold">
                      {item.brand}
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

                  <div
                    onClick={() => onNavigate('product-details', item.id)}
                    className="cursor-pointer relative w-full h-44 rounded-xl flex items-center justify-center p-3 mb-4 overflow-hidden bg-slate-50 dark:bg-[#0A0A0C]"
                  >
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      className="product-cutout max-h-32 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                        {item.category}
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

                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="font-display text-lg font-bold font-mono text-slate-900 dark:text-white">
                        {formatPrice(item.basePrice)}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">تومان</span>
                    </div>

                    <button
                      onClick={() => addToCart(item, defaultVariant)}
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
        )}
      </div>
    </div>
  );
};
