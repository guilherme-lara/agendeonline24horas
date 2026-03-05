import { useState, useEffect } from "react";
import { Loader2, Package, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  sell_price: number;
}

interface CompletionModalProps {
  open: boolean;
  onClose: () => void;
  barbershopId: string;
  appointmentId: string;
  onCompleted: () => void;
}

interface ProductSale {
  inventoryId: string;
  name: string;
  qty: number;
  price: number;
}

const CompletionModal = ({ open, onClose, barbershopId, appointmentId, onCompleted }: CompletionModalProps) => {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState<ProductSale[]>([]);

  useEffect(() => {
    if (!open) return;
    (supabase
      .from("inventory") as any)
      .select("id, name, quantity, sell_price")
      .eq("barbershop_id", barbershopId)
      .eq("active", true)
      .gt("quantity", 0)
      .order("name")
      .then(({ data }: any) => {
        setItems((data as InventoryItem[]) || []);
        setSales([]);
        setLoading(false);
      });
  }, [open, barbershopId]);

  const toggleProduct = (item: InventoryItem, checked: boolean) => {
    if (checked) {
      setSales((prev) => [...prev, { inventoryId: item.id, name: item.name, qty: 1, price: item.sell_price }]);
    } else {
      setSales((prev) => prev.filter((s) => s.inventoryId !== item.id));
    }
  };

  const updateQty = (inventoryId: string, qty: number) => {
    setSales((prev) => prev.map((s) => s.inventoryId === inventoryId ? { ...s, qty: Math.max(1, qty) } : s));
  };

  const totalProducts = sales.reduce((sum, s) => sum + s.qty * s.price, 0);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Mark appointment as completed
      await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointmentId);

      // Deduct stock for each sold product
      for (const sale of sales) {
        await supabase
          .from("inventory")
          .update({ quantity: items.find((i) => i.id === sale.inventoryId)!.quantity - sale.qty })
          .eq("id", sale.inventoryId);

        await supabase.from("stock_movements").insert({
          barbershop_id: barbershopId,
          inventory_id: sale.inventoryId,
          type: "out",
          quantity: sale.qty,
          notes: `Venda no atendimento`,
        });
      }

      toast({ title: "Atendimento concluído!", description: sales.length > 0 ? `${sales.length} produto(s) vendido(s)` : undefined });
      onCompleted();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Concluir Atendimento
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {items.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">Selecione produtos vendidos (opcional):</p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {items.map((item) => {
                    const sale = sales.find((s) => s.inventoryId === item.id);
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                        <Checkbox
                          checked={!!sale}
                          onCheckedChange={(checked) => toggleProduct(item, !!checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            R$ {item.sell_price.toFixed(2).replace(".", ",")} • Estoque: {item.quantity}
                          </p>
                        </div>
                        {sale && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQty(item.id, sale.qty - 1)}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <Input
                              type="number"
                              value={sale.qty}
                              onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                              className="w-12 h-6 text-center text-xs bg-secondary border-border p-0"
                              min={1}
                              max={item.quantity}
                            />
                            <button
                              onClick={() => updateQty(item.id, Math.min(sale.qty + 1, item.quantity))}
                              className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {sales.length > 0 && (
                  <div className="text-right text-sm">
                    Produtos: <span className="font-bold text-primary">R$ {totalProducts.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleConfirm}
              disabled={saving}
              className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Conclusão
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompletionModal;
