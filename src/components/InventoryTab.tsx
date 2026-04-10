import { useState, useEffect } from "react";
import { Package, Plus, Minus, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  min_quantity: number;
  cost_price: number;
  sell_price: number;
  category: string;
  active: boolean;
}

interface InventoryTabProps {
  barbershopId: string;
}

const statusIcon = (item: InventoryItem) => {
  if (item.quantity <= 0) return <XCircle className="h-4 w-4 text-destructive" />;
  if (item.quantity <= item.min_quantity) return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
  return <CheckCircle2 className="h-4 w-4 text-green-400" />;
};

const statusLabel = (item: InventoryItem) => {
  if (item.quantity <= 0) return "Esgotado";
  if (item.quantity <= item.min_quantity) return "Estoque Baixo";
  return "OK";
};

const statusBg = (item: InventoryItem) => {
  if (item.quantity <= 0) return "border-destructive/30 bg-destructive/5";
  if (item.quantity <= item.min_quantity) return "border-yellow-500/30 bg-yellow-500/5";
  return "border-border bg-card";
};

const InventoryTab = ({ barbershopId }: InventoryTabProps) => {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<"entry" | "exit">("entry");
  const [movementQty, setMovementQty] = useState("1");
  const [movementNotes, setMovementNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Add form
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("10");
  const [newMin, setNewMin] = useState("5");
  const [newCost, setNewCost] = useState("0");
  const [newSell, setNewSell] = useState("0");
  const [newCategory, setNewCategory] = useState("geral");

  const fetchItems = async () => {
    const { data } = await (supabase
      .from("inventory") as any)
      .select("*")
      .eq("barbershop_id", barbershopId)
      .eq("active", true)
      .order("name");
    setItems((data as InventoryItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [barbershopId]);

  const handleAddItem = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await (supabase.from("inventory") as any).insert({
      barbershop_id: barbershopId,
      name: newName.trim(),
      quantity: parseInt(newQty) || 0,
      min_quantity: parseInt(newMin) || 5,
      cost_price: parseFloat(newCost) || 0,
      sell_price: parseFloat(newSell) || 0,
      category: newCategory.trim() || "geral",
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto adicionado!" });
      setNewName(""); setNewQty("10"); setNewMin("5"); setNewCost("0"); setNewSell("0");
      setShowAdd(false);
      fetchItems();
    }
    setSaving(false);
  };

  const handleMovement = async () => {
    if (!movementItem) return;
    const qty = parseInt(movementQty) || 0;
    if (qty <= 0) return;
    if (movementType === "exit" && qty > movementItem.quantity) {
      toast({ title: "Erro", description: "Quantidade maior que o estoque disponível.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const newQuantity = movementType === "entry" ? movementItem.quantity + qty : movementItem.quantity - qty;

    const [movRes, updRes] = await Promise.all([
      (supabase.from("stock_movements") as any).insert({
        barbershop_id: barbershopId,
        inventory_id: movementItem.id,
        type: movementType,
        quantity: qty,
        notes: movementNotes.trim(),
      }),
      (supabase.from("inventory") as any)
        .update({ quantity: newQuantity })
        .eq("id", movementItem.id)
        .eq("barbershop_id", barbershopId),
    ]);

    if (movRes.error || updRes.error) {
      toast({ title: "Erro", description: (movRes.error || updRes.error)?.message, variant: "destructive" });
    } else {
      toast({ title: movementType === "entry" ? "Entrada registrada!" : "Saída registrada!" });
      setMovementItem(null);
      setMovementQty("1");
      setMovementNotes("");
      fetchItems();
    }
    setSaving(false);
  };

  const lowStockCount = items.filter((i) => i.quantity <= i.min_quantity).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Estoque</h2>
          {lowStockCount > 0 && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
              {lowStockCount} alerta{lowStockCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Produto
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
            Adicionar primeiro produto
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${statusBg(item)}`}>
              <div className="flex items-center gap-3">
                {statusIcon(item)}
                <div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} un. • Mín: {item.min_quantity} • {statusLabel(item)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground mr-2">
                  R$ {Number(item.sell_price).toFixed(2).replace(".", ",")}
                </p>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  onClick={() => { setMovementItem(item); setMovementType("entry"); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                  onClick={() => { setMovementItem(item); setMovementType("exit"); }}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do produto" className="bg-secondary border-border" maxLength={100} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Qtd. Inicial</label>
                <Input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} className="bg-secondary border-border" min="0" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Qtd. Mínima</label>
                <Input type="number" value={newMin} onChange={(e) => setNewMin(e.target.value)} className="bg-secondary border-border" min="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço Custo (R$)</label>
                <Input type="number" value={newCost} onChange={(e) => setNewCost(e.target.value)} className="bg-secondary border-border" min="0" step="0.01" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço Venda (R$)</label>
                <Input type="number" value={newSell} onChange={(e) => setNewSell(e.target.value)} className="bg-secondary border-border" min="0" step="0.01" />
              </div>
            </div>
            <Button onClick={handleAddItem} disabled={saving || !newName.trim()} className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar Produto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={!!movementItem} onOpenChange={() => setMovementItem(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {movementType === "entry" ? "Entrada" : "Saída"} — {movementItem?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">Estoque atual: {movementItem?.quantity} un.</p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
              <Input type="number" value={movementQty} onChange={(e) => setMovementQty(e.target.value)} className="bg-secondary border-border" min="1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Observação (opcional)</label>
              <Input value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} placeholder="Ex: Compra fornecedor X" className="bg-secondary border-border" maxLength={200} />
            </div>
            <Button
              onClick={handleMovement}
              disabled={saving || !movementQty}
              className={`w-full font-semibold hover:opacity-90 ${
                movementType === "entry"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar {movementType === "entry" ? "Entrada" : "Saída"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryTab;
