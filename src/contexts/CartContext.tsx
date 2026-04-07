import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  duration: number;
  type: "service" | "product";
  advance_payment_value?: number;
  price_is_starting_at?: boolean;
  // For services
  barber_id?: string;
  barber_name?: string;
  category_id?: string;
  // For products
  quantity?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalPrice: number;
  totalDuration: number;
  totalAdvancePayment: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem("booking_cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("booking_cart", JSON.stringify(items));
    } catch {
      /* localStorage full or unavailable */
    }
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      // Services: check duplicate by id, don't add again
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, { ...item, quantity: item.type === "product" ? (item.quantity ?? 1) : undefined }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, quantity: Math.max(1, quantity) }
          : i
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalPrice = items.reduce((sum, i) => {
    const qty = i.type === "product" ? (i.quantity ?? 1) : 1;
    return sum + (i.price ?? 0) * qty;
  }, 0);

  const totalDuration = items.reduce((sum, i) => sum + (i.duration ?? 0), 0);
  const totalAdvancePayment = items.reduce(
    (sum, i) =>
      sum +
      (i.advance_payment_value && i.advance_payment_value > 0
        ? i.advance_payment_value
        : i.price ?? 0),
    0
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalPrice, totalDuration, totalAdvancePayment }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
