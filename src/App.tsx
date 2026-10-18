import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { FavoritesProvider } from './context/FavoritesContext.tsx';

import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { AuthModal } from './components/AuthModal.tsx';

import { HomePage } from './pages/HomePage.tsx';
import { ProductDetailsPage } from './pages/ProductDetailsPage.tsx';
import { CartPage } from './pages/CartPage.tsx';
import { AiChatPage } from './pages/AiChatPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { UserAccountPage } from './pages/UserAccountPage.tsx';
import { FavoritesPage } from './pages/FavoritesPage.tsx';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>('home');
  const [selectedProductId, setSelectedProductId] = useState<string>('prod-macbook-pro-16');
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
              <div className="min-h-screen flex flex-col transition-colors duration-200 bg-[#F8FAFC] dark:bg-[#0B0B0C] text-slate-800 dark:text-zinc-100 antialiased selection:bg-blue-600 selection:text-white">
                {/* Navbar only shown on regular customer views; AI Assist and Admin have their own dedicated top bars matching Stitch design */}
                {currentPath !== 'admin-dashboard' && currentPath !== 'ai-assist' && (
                  <Navbar
                    currentPath={currentPath}
                    onNavigate={navigate}
                    onSearch={handleGlobalSearch}
                  />
                )}

                {/* View Routing */}
                <div className="flex-1">
                  {currentPath === 'home' && <HomePage onNavigate={navigate} />}
                  {currentPath === 'products' && (
                    <CatalogPage onNavigate={navigate} initialQuery={searchQuery} />
                  )}
                  {currentPath === 'categories' && <CatalogPage onNavigate={navigate} />}
                  {currentPath === 'special-offers' && <HomePage onNavigate={navigate} />}
                  {currentPath === 'product-details' && (
                    <ProductDetailsPage productId={selectedProductId} onNavigate={navigate} />
                  )}
                  {currentPath === 'cart' && <CartPage onNavigate={navigate} />}
                  {currentPath === 'favorites' && <FavoritesPage onNavigate={navigate} />}
                  {currentPath === 'ai-assist' && <AiChatPage onNavigate={navigate} />}
                  {currentPath === 'admin-dashboard' && (
                    <AdminDashboardPage onNavigate={navigate} />
                  )}
                  {currentPath === 'account' && <UserAccountPage onNavigate={navigate} />}
                </div>

                {/* Footer */}
                {currentPath !== 'admin-dashboard' && currentPath !== 'ai-assist' && (
                  <Footer onNavigate={navigate} />
                )}

                {/* Global Authentication Modal */}
                <AuthModal />
              </div>
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
