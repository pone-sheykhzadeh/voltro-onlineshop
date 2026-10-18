import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Product } from '../types/index.ts';
import { useAuth } from './AuthContext.tsx';
import { useToast } from './ToastContext.tsx';

interface FavoritesContextType {
  favorites: Product[];
  favoriteIds: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Product) => Promise<boolean>;
  removeFavorite: (productId: string) => Promise<void>;
  isLoading: boolean;
  favoritesCount: number;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);
const LOCAL_STORAGE_FAVS = 'voltro_guest_favorites_ids';

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [favorites, setFavorites] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load favorites from server when authenticated, or from local storage for guests
  const loadFavorites = useCallback(async () => {
    if (token) {
      setIsLoading(true);
      try {
        const res = await fetch('/api/favorites', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const items: Product[] = data.favorites || [];
          setFavorites(items);
          setFavoriteIds(new Set(items.map((p) => p.id)));
          return;
        }
      } catch (err) {
        console.error('Failed to fetch favorites from server:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Guest mode: load IDs from local storage and resolve against catalog
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_FAVS);
        if (saved) {
          const ids: string[] = JSON.parse(saved);
          setFavoriteIds(new Set(ids));
          // Fetch catalog to resolve products
          const catRes = await fetch('/api/products');
          if (catRes.ok) {
            const allProducts: Product[] = await catRes.json();
            const matched = allProducts.filter((p) => ids.includes(p.id));
            setFavorites(matched);
          }
        } else {
          setFavorites([]);
          setFavoriteIds(new Set());
        }
      } catch (err) {
        console.error('Failed to load guest favorites:', err);
      } finally {
        setIsLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const isFavorite = useCallback(
    (productId: string) => favoriteIds.has(productId),
    [favoriteIds]
  );

  const toggleFavorite = async (product: Product): Promise<boolean> => {
    const currentlyFav = favoriteIds.has(product.id);
    const nextFavState = !currentlyFav;

    // Optimistic UI update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (nextFavState) next.add(product.id);
      else next.delete(product.id);
      return next;
    });

    setFavorites((prev) => {
      if (nextFavState) {
        if (!prev.some((p) => p.id === product.id)) return [product, ...prev];
        return prev;
      } else {
        return prev.filter((p) => p.id !== product.id);
      }
    });

    if (token) {
      try {
        const res = await fetch('/api/favorites/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId: product.id }),
        });

        if (!res.ok) {
          throw new Error('Server returned error');
        }

        const data = await res.json();
        if (data.isFavorite) {
          showToast(`کالای «${product.name}» به علاقه‌مندی‌ها اضافه شد.`, 'success');
        } else {
          showToast(`کالای «${product.name}» از علاقه‌مندی‌ها حذف شد.`, 'info');
        }
        return data.isFavorite;
      } catch (err) {
        // Rollback on network failure
        setFavoriteIds((prev) => {
          const rollback = new Set(prev);
          if (currentlyFav) rollback.add(product.id);
          else rollback.delete(product.id);
          return rollback;
        });
        showToast('خطا در همگام‌سازی علاقه‌مندی‌ها با سرور.', 'error');
        return currentlyFav;
      }
    } else {
      // Guest mode persistence
      try {
        const currentIds = Array.from(favoriteIds);
        const updatedIds = nextFavState
          ? [...currentIds, product.id]
          : currentIds.filter((id) => id !== product.id);
        localStorage.setItem(LOCAL_STORAGE_FAVS, JSON.stringify(updatedIds));

        if (nextFavState) {
          showToast(`کالای «${product.name}» به علاقه‌مندی‌ها اضافه شد.`, 'success');
        } else {
          showToast(`کالای «${product.name}» از علاقه‌مندی‌ها حذف شد.`, 'info');
        }
      } catch {
        // Ignore storage error
      }
      return nextFavState;
    }
  };

  const removeFavorite = async (productId: string) => {
    const prod = favorites.find((p) => p.id === productId);
    if (prod) {
      await toggleFavorite(prod);
    } else {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setFavorites((prev) => prev.filter((p) => p.id !== productId));
      if (token) {
        fetch('/api/favorites/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId }),
        }).catch(() => {});
      }
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        favoriteIds,
        isFavorite,
        toggleFavorite,
        removeFavorite,
        isLoading,
        favoritesCount: favorites.length,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
