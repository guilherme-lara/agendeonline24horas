import { useState } from "react";
import { Trash2, ShoppingBag, Plus, CreditCard, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

export interface CartItem {
  id: string; // temp ID (can be uuid or appointment.id)
  item_type: "product" | "service";
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  barber_id?: string; 
  barber_name?: string;
  source_appointment_id?: string;
}

interface CartPanelProps {
  items: CartItem[];
  customerName: string;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  onSaveOpenSale?: () => void;
}

export function CartPanel({ items, customerName, onRemoveItem, onCheckout, onClear, onSaveOpenSale }: CartPanelProps) {
  const total = items.reduce((acc, item) => acc + item.total_price, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">Comanda Atual</h2>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50">
            Limpar
          </Button>
        )}
      </div>
      
      {customerName && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-medium border-b border-blue-100 dark:border-blue-900/50">
          Cliente: {customerName}
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <ShoppingBag className="w-10 h-10 mb-2 opacity-20" />
            <p>Nenhuma venda iniciada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start p-3 bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{item.name}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {item.quantity}x R$ {item.unit_price.toFixed(2).replace(".", ",")}
                  </span>
                  {item.barber_name && (
                    <span className="text-xs text-primary/80 mt-1">Prof: {item.barber_name}</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-bold text-sm">R$ {item.total_price.toFixed(2).replace(".", ",")}</span>
                  <button 
                    onClick={() => onRemoveItem(item.id)}
                    className="text-rose-500 hover:text-rose-600 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/50 shrink-0 space-y-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total</span>
          <span>R$ {total.toFixed(2).replace(".", ",")}</span>
        </div>
        <div className="flex gap-2">
          {onSaveOpenSale && (
             <Button 
               variant="outline"
               size="lg" 
               className="flex-1 h-14 font-bold" 
               disabled={items.length === 0}
               onClick={onSaveOpenSale}
             >
               Deixar Aberta
             </Button>
          )}
          <Button 
            size="lg" 
            className="flex-1 h-14 text-lg font-bold shadow-md" 
            disabled={items.length === 0}
            onClick={onCheckout}
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Cobrar
          </Button>
        </div>
      </div>
    </div>
  );
}
