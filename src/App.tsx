import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { FavoritesProvider } from './context/FavoritesContext.tsx';
import { ComparisonProvider } from './context/ComparisonContext.tsx';

import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { ComparisonBar } from './components/ComparisonBar.tsx';

import { HomePage } from './pages/HomePage.tsx';

// Code-split secondary routes to minimize initial bundle payload
const ProductDetailsPage = lazy(() =>
  import('./pages/ProductDetailsPage.tsx').then((m) => ({ default: m.ProductDetailsPage }))
);
const CartPage = lazy(() =>
  import('./pages/CartPage.tsx').then((m) => ({ default: m.CartPage }))
);
const AiChatPage = lazy(() =>
  import('./pages/AiChatPage.tsx').then((m) => ({ default: m.AiChatPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage.tsx').then((m) => ({ default: m.AdminDashboardPage }))
);
const CatalogPage = lazy(() =>
  import('./pages/CatalogPage.tsx').then((m) => ({ default: m.CatalogPage }))
);
const UserAccountPage = lazy(() =>
  import('./pages/UserAccountPage.tsx').then((m) => ({ default: m.UserAccountPage }))
);
const FavoritesPage = lazy(() =>
  import('./pages/FavoritesPage.tsx').then((m) => ({ default: m.FavoritesPage }))
);
const ComparisonPage = lazy(() =>
  import('./pages/ComparisonPage.tsx').then((m) => ({ default: m.ComparisonPage }))
);

const RouteLoadingFallback = () => (
  <div className="w-full min-h-[60vh] pt-28 flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B0B0C]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">در حال بارگذاری...</span>
    </div>
  </div>
);

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    const [route] = hash.split('/');
    return route || 'home';
  });
  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    const [, param] = hash.split('/');
    return param || 'prod-macbook-pro-16';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Handle URL hash or browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      const [route, param] = hash.split('/');
      if (route) setCurrentPath(route);
      if (param) setSelectedProductId(param);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string, param?: string) => {
    setCurrentPath(path);
    if (param) setSelectedProductId(param);
    window.location.hash = param ? `${path}/${param}` : path;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGlobalSearch = (query: string) => {
    setSearchQuery(query);
    navigate('products');
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <ComparisonProvider>
                <div className="min-h-screen flex flex-col transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100 antialiased selection:bg-blue-600 selection:text-white">
                  {/* Navbar only shown on regular customer views; AI Assist and Admin have their own dedicated top bars */}
                  {currentPath !== 'admin-dashboard' && currentPath !== 'ai-assist' && (
                    <Navbar
                      currentPath={currentPath}
                      onNavigate={navigate}
                      onSearch={handleGlobalSearch}
                    />
                  )}

                  {/* View Routing */}
                  <div className="flex-1">
                    <Suspense fallback={<RouteLoadingFallback />}>
                      {currentPath === 'home' && <HomePage onNavigate={navigate} />}
                      {currentPath === 'products' && (
                        <CatalogPage onNavigate={navigate} initialQuery={searchQuery} />
                      )}
                      {currentPath === 'categories' && <CatalogPage onNavigate={navigate} />}
                      {currentPath === 'special-offers' && <HomePage onNavigate={navigate} />}
                      {(currentPath === 'product-details' || currentPath === 'product') && (
                        <ProductDetailsPage productId={selectedProductId} onNavigate={navigate} />
                      )}
                      {currentPath === 'cart' && <CartPage onNavigate={navigate} />}
                      {currentPath === 'favorites' && <FavoritesPage onNavigate={navigate} />}
                      {(currentPath === 'compare' || currentPath === 'comparison') && (
                        <ComparisonPage onNavigate={navigate} />
                      )}
                      {currentPath === 'ai-assist' && <AiChatPage onNavigate={navigate} />}
                      {currentPath === 'admin-dashboard' && (
                        <AdminDashboardPage onNavigate={navigate} />
                      )}
                      {currentPath === 'account' && <UserAccountPage onNavigate={navigate} />}
                    </Suspense>
                  </div>

                  {/* Floating Comparison Drawer Bar */}
                  {currentPath !== 'admin-dashboard' && currentPath !== 'ai-assist' && currentPath !== 'compare' && (
                    <ComparisonBar onNavigate={navigate} />
                  )}

                  {/* Footer */}
                  {currentPath !== 'admin-dashboard' && currentPath !== 'ai-assist' && (
                    <Footer onNavigate={navigate} />
                  )}

                  {/* Global Authentication Modal */}
                  <AuthModal />
                </div>
              </ComparisonProvider>
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
