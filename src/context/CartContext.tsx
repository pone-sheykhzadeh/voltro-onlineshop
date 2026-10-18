import React, { createContext, useContext, useEffect, useState } from 'react';
import type { CartItem, Product, ProductVariant } from '../types/index.ts';
import { useAuth } from './AuthContext.tsx';
import { useToast } from './ToastContext.tsx';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  totalAmount: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'voltro_offline_cart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { token } = useAuth();
  const { showToast } = useToast();

  // Load cart initially
  useEffect(() => {
    const fetchCart = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/cart', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.cart && data.cart.length > 0) {
            setItems(data.cart);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to load cart from server, using local fallback:', err);
      }

      // Fallback to local storage if server returned empty/failed
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch (e) {
          setItems([]);
        }
      }
      setIsLoading(false);
    };

    fetchCart();
  }, [token]);

  // Sync cart changes with server & localStorage
  const syncCart = async (newItems: CartItem[]) => {
    setItems(newItems);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/cart', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: newItems.map((i) => ({
            id: i.id,
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        }),
      });
    } catch (e) {
      console.warn('Background cart sync failed:', e);
    }
  };

  const addToCart = (product: Product, variant: ProductVariant, quantity: number = 1) => {
    if (variant.stock <= 0) {
      showToast('متأسفانه این مدل هم‌اکنون ناموجود است.', 'error');
      return;
    }

    const existingIndex = items.findIndex(
      (i) => i.productId === product.id && i.variantId === variant.id
    );

    let updated: CartItem[];
    if (existingIndex !== -1) {
      updated = [...items];
      const newQty = updated[existingIndex].quantity + quantity;
      if (newQty > variant.stock) {
        showToast(`حداکثر موجودی قابل سفارش ${variant.stock} عدد است.`, 'error');
        return;
      }
      updated[existingIndex].quantity = newQty;
    } else {
      const newItem: CartItem = {
        id: `cart-item-${Date.now()}-${Math.random()}`,
        productId: product.id,
        variantId: variant.id,
        quantity,
        product,
        variant,
      };
      updated = [newItem, ...items];
    }

    syncCart(updated);
    showToast(`«${product.name}» به سبد خرید اضافه شد.`, 'success');
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const updated = items.map((i) => {
      if (i.id === itemId) {
        if (quantity > i.variant.stock) {
          showToast(`تنها ${i.variant.stock} عدد در انبار موجود است.`, 'error');
          return i;
        }
        return { ...i, quantity };
      }
      return i;
    });

    syncCart(updated);
  };

  const removeFromCart = (itemId: string) => {
    const updated = items.filter((i) => i.id !== itemId);
    syncCart(updated);
    showToast('کالا از سبد خرید حذف شد.', 'info');
  };

  const clearCart = () => {
    syncCart([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  const totalAmount = subtotal;

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        itemCount,
        subtotal,
        totalAmount,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
