import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Product } from '../types/index.ts';
import { useToast } from './ToastContext.tsx';

interface ComparisonContextType {
  comparisonIds: string[];
  comparisonProducts: Product[];
  addToComparison: (product: Product) => boolean;
  removeFromComparison: (productId: string) => void;
  clearComparison: () => void;
  isInComparison: (productId: string) => boolean;
  count: number;
  canAddMore: boolean;
  allProducts: Product[];
  loadAllProducts: () => Promise<void>;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);
const LOCAL_STORAGE_COMPARISON = 'voltro_comparison_product_ids';
const MAX_COMPARISON_ITEMS = 4;

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [comparisonIds, setComparisonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_COMPARISON);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, MAX_COMPARISON_ITEMS);
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [comparisonProducts, setComparisonProducts] = useState<Product[]>([]);

  // Fetch all products to resolve items
  const loadAllProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        const list: Product[] = Array.isArray(data) ? data : data.products || [];
        setAllProducts(list);
      }
    } catch (err) {
      console.warn('Failed to load products for comparison:', err);
    }
  }, []);

  useEffect(() => {
    loadAllProducts();
  }, [loadAllProducts]);

  // Sync comparisonProducts whenever comparisonIds or allProducts changes
  useEffect(() => {
    if (allProducts.length > 0) {
      const matched = comparisonIds
        .map((id) => allProducts.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p));
      setComparisonProducts(matched);
    }
  }, [comparisonIds, allProducts]);

  // Persist to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_COMPARISON, JSON.stringify(comparisonIds));
    } catch (e) {
      console.warn('Failed to save comparison to localStorage:', e);
    }
  }, [comparisonIds]);

  const isInComparison = useCallback(
    (productId: string) => {
      return comparisonIds.includes(productId);
    },
    [comparisonIds]
  );

  const addToComparison = useCallback(
    (product: Product): boolean => {
      if (comparisonIds.includes(product.id)) {
        showToast('این محصول در لیست مقایسه موجود است.', 'info');
        return false;
      }
      if (comparisonIds.length >= MAX_COMPARISON_ITEMS) {
        showToast(`حداکثر ${MAX_COMPARISON_ITEMS} کالا را می‌توانید به صورت همزمان مقایسه کنید.`, 'error');
        return false;
      }

      setComparisonIds((prev) => [...prev, product.id]);
      setComparisonProducts((prev) => [...prev, product]);
      showToast(`«${product.name}» به لیست مقایسه افزوده شد.`, 'success');
      return true;
    },
    [comparisonIds, showToast]
  );

  const removeFromComparison = useCallback(
    (productId: string) => {
      setComparisonIds((prev) => prev.filter((id) => id !== productId));
      setComparisonProducts((prev) => prev.filter((p) => p.id !== productId));
      showToast('محصول از لیست مقایسه حذف گردید.', 'info');
    },
    [showToast]
  );

  const clearComparison = useCallback(() => {
    setComparisonIds([]);
    setComparisonProducts([]);
    showToast('لیست مقایسه خالی شد.', 'info');
  }, [showToast]);

  return (
    <ComparisonContext.Provider
      value={{
        comparisonIds,
        comparisonProducts,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isInComparison,
        count: comparisonIds.length,
        canAddMore: comparisonIds.length < MAX_COMPARISON_ITEMS,
        allProducts,
        loadAllProducts,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
};

export function useComparison(): ComparisonContextType {
  const ctx = useContext(ComparisonContext);
  if (!ctx) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return ctx;
}
