import { Trash2, ShoppingBag, Plus, CreditCard, User, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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
  advance_payment?: number; // Sinal pago online
}

interface CartPanelProps {
  items: CartItem[];
  customerName: string;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  onSaveOpenSale?: () => void;
  onAddManualItem?: () => void;
}

export function CartPanel({
  items,
  customerName,
  onRemoveItem,
  onCheckout,
  onClear,
  onSaveOpenSale,
  onAddManualItem,
}: CartPanelProps) {
  const subtotal = items.reduce((acc, item) => acc + item.total_price, 0);
  const totalDeposit = items.reduce((acc, item) => acc + (item.advance_payment || 0), 0);
  const totalDue = Math.max(0, subtotal - totalDeposit);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Top Header */}
      <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">Comanda Atual</h2>
            <p className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "item" : "itens"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAddManualItem && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddManualItem}
              className="text-xs h-8 font-medium gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Item
            </Button>
          )}
          {(items.length > 0 || customerName) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-xs h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>
      
      {/* Customer Card */}
      <div className="px-4 py-3 bg-muted/10 border-b border-border">
        {customerName ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</p>
                <p className="text-sm font-bold text-foreground truncate">{customerName}</p>
              </div>
            </div>
            {totalDeposit > 0 && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs shrink-0 font-medium">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Sinal R$ {totalDeposit.toFixed(2).replace(".", ",")}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
            <User className="w-4 h-4 text-muted-foreground/60" />
            <span>Nenhum cliente selecionado (venda avulsa)</span>
          </div>
        )}
      </div>

      {/* Items List */}
      <ScrollArea className="flex-1 p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6 opacity-30" />
            </div>
            <p className="font-semibold text-sm text-foreground">Comanda vazia</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Clique em &quot;Adicionar à Comanda&quot; na fila ao lado para iniciar o fechamento.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-start p-3 bg-background border border-border/70 rounded-xl shadow-xs hover:border-border transition-colors group"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">{item.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0">
                      {item.item_type === "service" ? "Serviço" : "Produto"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{item.quantity}x R$ {item.unit_price.toFixed(2).replace(".", ",")}</span>
                    {item.barber_name && (
                      <>
                        <span>•</span>
                        <span className="text-primary font-medium">{item.barber_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-sm text-foreground">
                    R$ {item.total_price.toFixed(2).replace(".", ",")}
                  </span>
                  <button 
                    onClick={() => onRemoveItem(item.id)}
                    className="text-muted-foreground/60 hover:text-rose-500 transition-colors p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Remover item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer / Totalizer */}
      <div className="p-4 border-t border-border bg-muted/20 shrink-0 space-y-4">
        {/* Breakdown */}
        <div className="space-y-1.5">
          {totalDeposit > 0 && (
            <>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Subtotal dos itens</span>
                <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sinal Online Abatido
                </span>
                <span>- R$ {totalDeposit.toFixed(2).replace(".", ",")}</span>
              </div>
            </>
          )}

          {/* Giant Total */}
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Total {totalDeposit > 0 ? "a Pagar" : ""}
            </span>
            <div className="text-right">
              <span className="text-3xl font-black tracking-tight text-foreground">
                R$ {totalDue.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Giant Cobrar Button */}
          <Button 
            size="lg" 
            className="w-full h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 rounded-xl transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none" 
            disabled={items.length === 0}
            onClick={onCheckout}
          >
            <CreditCard className="w-6 h-6 mr-2 shrink-0" />
            Cobrar • R$ {totalDue.toFixed(2).replace(".", ",")}
          </Button>

          {onSaveOpenSale && items.length > 0 && (
            <Button 
              variant="outline"
              size="sm" 
              className="w-full h-9 text-xs font-medium text-muted-foreground hover:text-foreground" 
              onClick={onSaveOpenSale}
            >
              Salvar Comanda em Aberto
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
