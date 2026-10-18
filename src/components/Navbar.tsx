import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useFavorites } from '../context/FavoritesContext.tsx';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onSearch?: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate, onSearch }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, openAuthModal, logout } = useAuth();
  const { itemCount } = useCart();
  const { favoritesCount } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
    onNavigate('products');
  };

  const navLinks = [
    { id: 'home', label: 'صفحه اصلی' },
    { id: 'products', label: 'محصولات' },
    { id: 'categories', label: 'دسته‌بندی‌ها' },
    { id: 'special-offers', label: 'پیشنهاد ویژه' },
    { id: 'admin-dashboard', label: 'داشبورد مدیریت' },
  ];

  return (
    <header className="fixed top-0 w-full z-50 transition-colors duration-200 bg-white/90 dark:bg-[#0B0B0C]/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.06] shadow-xs">
      <div className="h-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="relative w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:border-blue-500 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.2)]">
            <span className="material-symbols-outlined text-xl text-blue-500">bolt</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-lg tracking-wider text-slate-900 dark:text-white">
              VOLTRO
            </span>
            <span className="font-mono text-[9px] text-blue-500 font-semibold tracking-widest uppercase">
              TECH LUXURY
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors bg-slate-100/90 dark:bg-[#141417]/90 border border-slate-200 dark:border-white/[0.06]">
          {navLinks.map((link) => {
            const isActive = currentPath === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.4)]'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800/50'
                }`}
              >
                {link.label}
              </button>
            );
          })}
          {/* AI Shopping Assistant Pill Button */}
          <button
            onClick={() => onNavigate('ai-assist')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              currentPath === 'ai-assist'
                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)]'
                : 'text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span>دستیار هوشمند خرید</span>
          </button>
        </nav>

        {/* Right / Left Actions */}
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative hidden md:flex items-center">
            <span className="material-symbols-outlined absolute right-3 text-slate-400 dark:text-zinc-500 text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی گجت‌ها..."
              className="w-48 lg:w-56 pl-3 pr-9 py-1.5 rounded-full text-xs transition-all border outline-none bg-slate-50 dark:bg-[#141417] text-slate-800 dark:text-zinc-100 border-slate-200 dark:border-white/[0.08] placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-500 focus:w-64"
            />
          </form>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={toggleTheme}
            aria-label="تغییر تم"
            title={theme === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
            className="p-2 rounded-full transition-all border text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-lg">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Wishlist Button */}
          <button
            onClick={() => onNavigate('favorites')}
            aria-label="علاقه‌مندی‌ها"
            className="relative p-2 rounded-full transition-all border text-slate-600 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 bg-slate-100 dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] cursor-pointer shadow-xs"
          >
            <span className={`material-symbols-outlined text-lg ${favoritesCount > 0 ? 'text-rose-500' : ''}`}>
              favorite
            </span>
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Shopping Cart Button */}
          <button
            onClick={() => onNavigate('cart')}
            aria-label="سبد خرید"
            className="relative p-2 rounded-full transition-all border text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-lg">shopping_bag</span>
            {itemCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.6)]">
                {itemCount}
              </span>
            )}
          </button>

          {/* User Account / Profile Menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 rounded-full border border-slate-200 dark:border-white/[0.08] hover:border-blue-500/50 transition-all cursor-pointer"
              >
                <img
                  src={user.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDDFf26GXqr-2c3bJ3L1A3MwQX5syyjKNU29_8haSa6wY-ehOAyVT9h0KPPuqZyBeNW-3ZtlnhTQBGbWqAJunHAjm8IELD3Oij-0TKsEVXjgxxSMai0bjZ-a5vjlTaCyC0etuntG4xCLek869jGnUh_zAsTDnZvcGknpApu4InT2qhAaD6_L9EuZXj58x38FBEJTE--zSBsugndzEPNdZBaU1y84sO1B3O1_AoHFWVNCpzx1F7Rflc'}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-blue-500/40"
                />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute left-0 mt-2 w-52 rounded-2xl p-2 shadow-2xl border transition-all z-50 bg-white dark:bg-[#141417] border-slate-200 dark:border-white/[0.08]">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06]">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {user.email}
                    </p>
                    {user.role === 'admin' && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/30">
                        مدیر ارشد سامانه
                      </span>
                    )}
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onNavigate('account');
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">person</span>
                      <span>حساب کاربری و سفارشات</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onNavigate('favorites');
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-rose-500">favorite</span>
                        <span>علاقه‌مندی‌های من</span>
                      </div>
                      {favoritesCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-500 font-bold">
                          {favoritesCount}
                        </span>
                      )}
                    </button>
                    {user.role === 'admin' && (
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          onNavigate('admin-dashboard');
                        }}
                        className="w-full text-right px-3 py-2 rounded-xl text-xs hover:bg-blue-50 dark:hover:bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">analytics</span>
                        <span>پنل مدیریت فروشگاه</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">logout</span>
                      <span>خروج از حساب</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.35)] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              <span>ورود / ثبت‌نام</span>
            </button>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-full border text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-[#141417] border-slate-200 dark:border-white/[0.06] cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden px-6 py-4 border-t transition-colors bg-white dark:bg-[#0B0B0C] border-slate-200 dark:border-white/[0.06] shadow-lg">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onNavigate(link.id);
                }}
                className={`text-right px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  currentPath === link.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/40'
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate('favorites');
              }}
              className={`text-right px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                currentPath === 'favorites'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-rose-500">favorite</span>
                <span>لیست علاقه‌مندی‌ها</span>
              </div>
              {favoritesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500 text-white">
                  {favoritesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate('ai-assist');
              }}
              className="text-right px-4 py-2.5 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 flex items-center justify-between cursor-pointer"
            >
              <span>دستیار هوشمند خرید ولترو</span>
              <span className="material-symbols-outlined text-base">auto_awesome</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
